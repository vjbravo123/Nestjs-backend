import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
} from '@nestjs/common';

import { CheckoutIntentDocument } from '../checkout/checkout-intent.schema';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { PaymentWithUser } from './entities/payment.schema';
import { Payment, PaymentDocument } from './entities/payment.schema';
import { CheckoutIntent } from '../checkout/checkout-intent.schema';
import { PhonePeGateway } from './gateways/phonepe.gateway';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

import {
    PaymentInitiatedEvent,
    PaymentSuccessEvent,
    PaymentFailedEvent,
    PAYMENT_EVENTS,
    PaymentOfflineSelectedEvent
} from './events/payment.events';
import { UserDocument } from '../users/users.schema';
import { PaymentConfigService } from '../booking-payments/payment-config.service';
import { PaymentOption } from './dto/initiate-payment.dto';

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);

    constructor(
        @InjectModel(Payment.name)
        private readonly paymentModel: Model<PaymentDocument>,

        @InjectModel(CheckoutIntent.name)
        private readonly checkoutIntentModel: Model<CheckoutIntent>,

        private readonly phonePeGateway: PhonePeGateway,
        private readonly eventEmitter: EventEmitter2,
        private readonly configService: ConfigService,
        private readonly paymentConfigService: PaymentConfigService,
    ) { }


    private getNearestEventDate(items: any[]): Date {
        const today = new Date();

        const futureDates = items
            .map(item => new Date(item.eventBookingDate))
            .filter(date => date > today)
            .sort((a, b) => a.getTime() - b.getTime());

        if (!futureDates.length) {
            throw new BadRequestException('No valid future event date found');
        }

        return futureDates[0]; // nearest
    }


    private async handleOfflinePayment(
        userId: Types.ObjectId,
        intent: CheckoutIntentDocument,
    ) {
        this.logger.log(`🟡 Offline payment selected | intent=${intent._id}`);

        // 1️⃣ Prevent duplicate offline payments
        const existing = await this.paymentModel.findOne({
            checkoutIntentId: intent._id,
            status: { $in: ['pending', 'completed'] },
        });

        if (existing) {
            return {
                paymentId: existing._id.toString(),
                status: existing.status,
                paymentOption: PaymentOption.OFFLINE,

                message: 'Offline payment already initiated.',
            };
        }

        // 2️⃣ Always FULL amount
        const totalAmount = Number(intent.totalAmount);

        const payment = await this.paymentModel.create({
            userId,
            checkoutIntentId: intent._id,
            amount: totalAmount,
            totalAmount,
            paymentOption: PaymentOption.OFFLINE,
            merchantOrderId: `OFFLINE_${intent._id}_${Date.now()}`,
            merchantTransactionId: `OFFLINE_TXN_${Date.now()}`,
            payPercent: 100, // 🔥 Force full
            currency: 'INR',
            status: 'success',
            gateway: 'offline',
        });

        // 3️⃣ Update intent
        intent.status = 'pending';
        intent.paymentOption = PaymentOption.OFFLINE;
        intent.payAmountPercent = 100;
        intent.totalPaybleAmount = totalAmount;
        await intent.save();

        // 4️⃣ Emit OFFLINE_SELECTED (NOT SUCCESS)
        this.eventEmitter.emit(
            PAYMENT_EVENTS.OFFLINE_SELECTED,
            new PaymentOfflineSelectedEvent(
                payment._id,
                userId,
                intent._id,        // ✅ must include this
                payment.amount,
            ),
        );

        return {
            paymentId: payment._id.toString(),
            status: payment.status,
            message:
                'Offline payment selected. Order pending verification.',
        };
    }
    // ==================================================
    // 🟢 INITIATE PAYMENT (IDEMPOTENT)
    // ==================================================
    // ==================================================
    async initiatePayment(userId: Types.ObjectId, dto: InitiatePaymentDto) {
        console.log('================ initiatePayment START ================');
        console.log('➡️ Request received');

        this.logger.log(
            `➡️ initiatePayment | userId=${userId} | intentId=${dto.checkoutIntentId}`,
        );



        // 1️⃣ Validate checkout intent
        console.log('🔍 Step 1: Validating checkout intent');

        const intent = await this.checkoutIntentModel.findOne({
            _id: dto.checkoutIntentId,
            userId,
            status: 'pending',
        });

        console.log('checkout intent result:', intent);

        if (!intent) {
            console.log('❌ Validation failed: Invalid or expired checkout intent');
            this.logger.warn(
                `❌ Invalid checkout intent | intentId=${dto.checkoutIntentId}`,
            );
            throw new BadRequestException('Invalid or expired checkout intent');
        }



        console.log('✅ Checkout intent valid:', intent._id.toString());
        if (dto.paymentOption === PaymentOption.OFFLINE) {
            return this.handleOfflinePayment(userId, intent);
        }

        // 2️⃣ Idempotency check
        console.log('🔍 Step 2: Checking existing pending payment');

        const existing = await this.paymentModel.findOne({
            checkoutIntentId: intent._id,
            status: { $in: ['initiated', 'pending'] },
        });

        console.log('existing payment result:', existing);

        if (existing) {
            console.log('🔁 Existing pending payment found');
            console.log('paymentId:', existing._id.toString());
            console.log('merchantOrderId:', existing?.merchantOrderId);

            this.logger.warn(
                `🔁 Reusing existing pending payment | paymentId=${existing._id} | intentId=${intent._id}`,
            );

            return {
                paymentId: existing._id.toString(),
                merchantOrderId: existing.merchantOrderId,
                amount: existing.amount,
                currency: existing.currency,
                status: existing.status,
                redirectUrl: existing.gatewayResponse?.redirectUrl,
            };
        }

        console.log('✅ No existing pending payment found');

        // 3️⃣ Callback URL
        console.log('🔍 Step 3: Preparing callback URL');

        const frontendUrl = this.configService.get<string>('FRONTEND_URL');

        if (!frontendUrl) {
            throw new BadRequestException('FRONTEND_URL not configured');
        }

        function encodeBookingId(batchId: string | number): string {
            const encoded = encodeURIComponent(
                Buffer.from(batchId.toString(), 'binary').toString('base64'),
            );
            return encoded;
        }

        function generateCallbackUrl(batchId: string | number): string {
            const encodedId = encodeBookingId(batchId);
            return `${frontendUrl}/dashboard/bookings/${encodedId}/payment-status`;
        }

        const callbackUrl = generateCallbackUrl(intent._id.toString());
        console.log('✅ Final callback URL:', callbackUrl);

        // ===============================
        // 🔐 Step 4: UPDATED AMOUNT FLOW
        // ===============================
        console.log('🔍 Step 4: Amount calculation with UPDATED FLOW');

        const totalAmount = Number(intent.totalAmount);
        console.log('💰 Total amount from DB (₹):', totalAmount);

        const paymentConfig = await this.paymentConfigService.getConfig();
        console.log("📦 paymentConfig loaded:", paymentConfig);

        // 🔹 Find nearest event date
        const eventDates = (intent.items as any[])
            .map((i) => new Date(i.eventBookingDate))
            .filter((d) => !isNaN(d.getTime()));

        console.log("📅 All event dates:", eventDates);

        if (!eventDates.length) {
            throw new BadRequestException('No valid event dates found');
        }

        const nearestEventDate = eventDates.reduce((a, b) => (a < b ? a : b));
        console.log('📅 Nearest event date:', nearestEventDate);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const eventDate = new Date(nearestEventDate);
        eventDate.setHours(0, 0, 0, 0);

        const daysRemaining = Math.max(
            Math.ceil(
                (eventDate.getTime() - today.getTime()) /
                (1000 * 60 * 60 * 24),
            ),
            0,
        );

        console.log('⏳ Days remaining:', daysRemaining);

        // 🔹 Minimum percent logic
        let minimumPercent = 100;

        if (
            paymentConfig.partialPay?.enabled &&
            paymentConfig.partialPay?.tiers?.length
        ) {
            const sortedTiers = [...paymentConfig.partialPay.tiers].sort(
                (a, b) => b.days - a.days,
            );

            for (const tier of sortedTiers) {
                if (daysRemaining >= tier.days) {
                    minimumPercent = tier.percent;
                    break;
                }
            }
        }

        console.log('📊 Minimum percent allowed:', minimumPercent);

        // ==================================================
        // 🔥 APPLY DISCOUNTS FIRST
        // ==================================================
        console.log('🔻 Applying discounts FIRST');

        let discountedTotal = totalAmount;
        let fullBonusApplied = 0;
        let onlineDiscountApplied = 0;

        if (
            dto.paymentOption === PaymentOption.FULL &&
            paymentConfig.fullBonus?.enabled &&
            paymentConfig.fullBonus.percent > 0
        ) {
            fullBonusApplied =
                (totalAmount * paymentConfig.fullBonus.percent) / 100;

            discountedTotal -= fullBonusApplied;
            console.log(`🎁 Full bonus applied: -₹${fullBonusApplied}`);
        }

        if (
            paymentConfig.onlineDiscount?.enabled &&
            paymentConfig.onlineDiscount.amount > 0
        ) {
            onlineDiscountApplied =
                paymentConfig.onlineDiscount.amount;

            discountedTotal -= onlineDiscountApplied;
            console.log(`💳 Online discount applied: -₹${onlineDiscountApplied}`);
        }

        discountedTotal = Math.max(discountedTotal, 1);

        console.log('💰 Total after discounts (₹):', discountedTotal);

        // ==================================================
        // 🔹 NOW APPLY PAYMENT OPTION PERCENT
        // ==================================================
        let payPercent: number;

        console.log("Selected paymentOption:", dto.paymentOption);
        console.log("Selected payAmountPercent:", dto.payAmountPercent);

        switch (dto.paymentOption) {
            case PaymentOption.FULL:
                payPercent = 100;
                console.log('FULL payment selected');
                break;

            case PaymentOption.MINIMUM:
                payPercent = minimumPercent;
                console.log(`MINIMUM payment selected → ${payPercent}%`);
                break;

            case PaymentOption.CUSTOM:
                if (dto.payAmountPercent == null) {
                    throw new BadRequestException(
                        'payAmountPercent is required for CUSTOM',
                    );
                }

                if (!paymentConfig.customSplit?.enabled) {
                    throw new BadRequestException(
                        'Custom split payment is disabled',
                    );
                }

                if (dto.payAmountPercent < minimumPercent) {
                    throw new BadRequestException(
                        `Minimum allowed percent is ${minimumPercent}%`,
                    );
                }

                if (dto.payAmountPercent > 100) {
                    throw new BadRequestException(
                        'payAmountPercent cannot exceed 100%',
                    );
                }

                payPercent = dto.payAmountPercent;
                console.log(`CUSTOM payment selected → ${payPercent}%`);
                break;

            default:
                payPercent = 100;
        }

        const rawAmount = (discountedTotal * payPercent) / 100;
        console.log(`🧮 Raw amount: ₹${rawAmount}`);

        const amount = Math.max(Math.round(rawAmount), 1);

        console.log('✅ Final rounded amount (₹):', amount);

        this.logger.log(
            `💰 Amount calc UPDATED | total=₹${totalAmount} | discounted=₹${discountedTotal} | percent=${payPercent}% | final=₹${amount}`,
        );

        // 5️⃣ Merchant transaction ID
        console.log('🔍 Step 5: Generating merchant transaction ID');

        const merchantTransactionId = `${intent._id.toString()}_${Date.now()}`;
        const amountInPaise = Math.round(amount * 100);

        console.log('Amount in paise:', amountInPaise);

        // 6️⃣ Call PhonePe
        console.log('📡 Step 6: Calling PhonePe initiate API');

        const gatewayResponse = await this.phonePeGateway.initiatePayment({
            amount: amountInPaise,
            merchantTransactionId,
            callbackUrl,
        });

        console.log('📨 PhonePe gateway response received');

        // 7️⃣ Save payment
        console.log('💾 Step 7: Saving payment in DB');

        const payment = await this.paymentModel.create({
            userId,
            checkoutIntentId: intent._id,
            amount,
            totalAmount,
            paymentOption: dto.paymentOption,
            payPercent,
            minimumPercent,
            daysRemaining,
            onlineDiscountApplied,
            fullBonusApplied,
            currency: 'INR',
            status: 'pending',
            gateway: 'phonepe',
            merchantOrderId: gatewayResponse.merchantOrderId,
            merchantTransactionId,
            gatewayResponse,
        });

        console.log('✅ Payment saved:', {
            paymentId: payment._id.toString(),
            status: payment.status,
        });

        // 8️⃣ Emit event
        console.log('📢 Step 8: Emitting PAYMENT_INITIATED event');

        this.eventEmitter.emit(
            PAYMENT_EVENTS.INITIATED,
            new PaymentInitiatedEvent(
                payment._id,
                userId,
                payment.amount,
                payment?.merchantOrderId,
            ),
        );

        intent.paymentOption = dto?.paymentOption ?? 'FULL';
        intent.payAmountPercent = minimumPercent;
        intent.nearestEventDate = nearestEventDate
        intent.totalPaybleAmount = discountedTotal

        await intent.save();

        this.logger.log(
            `✅ Payment initiated | paymentId=${payment._id} | merchantOrderId=${payment.merchantOrderId}`,
        );

        console.log('================ initiatePayment END ================');

        return {
            paymentId: payment._id.toString(),
            merchantOrderId: payment.merchantOrderId,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            redirectUrl: gatewayResponse.redirectUrl,
        };
    }



    // ==================================================
    // 🔴 PHONEPE WEBHOOK (SOURCE OF TRUTH)
    // ==================================================
    async handlePhonePeWebhook(payload: any, authorization: string) {
        console.log('\n================ START handlePhonePeWebhook ================');

        /* -------------------------------------------------
         * A️⃣ Initial logs
         * ------------------------------------------------- */
        console.log('📥 Webhook received');
        console.log('🔐 Authorization header present:', !!authorization);

        const event = payload?.event;
        const state = payload?.payload?.state;
        const merchantOrderId = payload?.payload?.merchantOrderId;

        console.log('➡️ Extracted event:', event);
        console.log('➡️ Extracted state:', state);
        console.log('➡️ Extracted merchantOrderId:', merchantOrderId);

        this.logger.log(
            `📩 PHONEPE WEBHOOK | event=${event} | state=${state} | merchantOrderId=${merchantOrderId}`,
        );

        /* -------------------------------------------------
         * 0️⃣ Verify webhook with PhonePe SDK
         * ------------------------------------------------- */
        let webhookData: any;

        try {
            console.log('⚙️ Verifying webhook via phonePeGateway.handleWebhook()');

            webhookData = await this.phonePeGateway.handleWebhook(
                payload,
                authorization,
            );

            console.log('✅ Webhook verification SUCCESS');
            console.log('📦 Verified webhookData:', JSON.stringify(webhookData, null, 2));
        } catch (error) {
            console.error('❌ Webhook verification FAILED', error);

            this.logger.error(
                `❌ PhonePe webhook verification failed | merchantOrderId=${merchantOrderId}`,
                error instanceof Error ? error.stack : String(error),
            );
            return;
        }

        /* -------------------------------------------------
         * 1️⃣ Fetch payment using merchantOrderId
         * ------------------------------------------------- */
        console.log(
            '🔍 Searching payment by merchantOrderId:',
            webhookData.merchantOrderId,
        );

        const payment = await this.paymentModel
            .findOne({ merchantOrderId: webhookData.merchantOrderId })
            .populate<{ userId: UserDocument }>('userId');

        console.log('➡️ Payment found:', !!payment);

        if (!payment) {
            console.warn(
                '⚠️ Payment NOT FOUND for merchantOrderId:',
                webhookData.merchantOrderId,
            );

            this.logger.warn(
                `⚠️ Webhook received for unknown merchantOrderId=${webhookData.merchantOrderId}`,
            );
            return;
        }

        console.log('✅ Payment details:', {
            paymentId: payment._id,
            status: payment.status,
            webhookProcessed: payment.webhookProcessed,
        });

        /* -------------------------------------------------
         * 2️⃣ Idempotency guard (CRITICAL)
         * ------------------------------------------------- */
        if (payment.webhookProcessed) {
            console.warn('🔁 Webhook already processed → SKIPPING');

            this.logger.warn(
                `🔁 Duplicate webhook ignored | paymentId=${payment._id}`,
            );
            return;
        }

        /* -------------------------------------------------
         * 3️⃣ Normalize payment status
         * ------------------------------------------------- */
        const normalizedStatus =
            webhookData.status === 'success'
                ? 'success'
                : webhookData.status === 'failed'
                    ? 'failed'
                    : 'pending';

        console.log('➡️ Normalized status:', normalizedStatus);

        if (normalizedStatus === 'pending') {
            console.warn('⏳ Payment still pending → ignoring webhook');

            this.logger.warn(
                `⏳ Pending webhook ignored | merchantOrderId=${payment.merchantOrderId}`,
            );
            return;
        }

        /* -------------------------------------------------
         * 4️⃣ Update payment record (CORE LOGIC)
         * ------------------------------------------------- */
        console.log('💾 Updating payment record...');

        // ===== BASE FIELDS =====
        payment.status = normalizedStatus;
        payment.gatewayTransactionId = webhookData.gatewayTransactionId;
        payment.gatewayResponse = webhookData.rawPayload;
        payment.webhookProcessed = true;

        if (normalizedStatus === 'success') {
            payment.paidAt = new Date();
            console.log('🕒 paidAt set:', payment.paidAt);
        }

        /* -------------------------------------------------
         * 🔥 STORE PHONEPE PAYMENT DETAILS (NEW SCHEMA)
         * ------------------------------------------------- */
        const phonePePayload = webhookData?.rawPayload?.payload;
        const paymentDetail = phonePePayload?.paymentDetails?.[0];

        if (phonePePayload) {
            console.log('📦 Storing PhonePe payload meta');

            payment.rawPayload = webhookData.rawPayload;
            payment.udf1 = phonePePayload?.metaInfo?.udf1;
            payment.feeAmount = phonePePayload?.feeAmount ?? 0;
        }

        if (paymentDetail) {
            console.log('💳 Storing payment instrument details');

            payment.paymentMethod = paymentDetail.paymentMode ?? 'UNKNOWN';

            payment.bankId =
                paymentDetail.instrument?.bankId ??
                paymentDetail.instrument?.ifsc ??
                undefined;

            payment.maskedInstrument =
                paymentDetail.instrument?.maskedCardNumber ??
                paymentDetail.instrument?.maskedAccountNumber ??
                undefined;

            // UPI specific
            payment.utr = paymentDetail.rail?.utr;

            // Card specific
            payment.authorizationCode =
                paymentDetail.rail?.authorizationCode ?? undefined;
        }

        await payment.save();

        console.log('✅ Payment saved successfully');

        this.logger.log(
            `💾 Payment updated | paymentId=${payment._id} | status=${payment.status}`,
        );

        /* -------------------------------------------------
         * 5️⃣ Emit domain events
         * ------------------------------------------------- */
        if (normalizedStatus === 'success') {
            console.log('🚀 Emitting PAYMENT_EVENTS.SUCCESS');

            this.eventEmitter.emit(
                PAYMENT_EVENTS.SUCCESS,
                new PaymentSuccessEvent(
                    payment._id,
                    payment.userId.id,
                    undefined,
                    payment.checkoutIntentId,
                    payment.amount, // RUPEES
                    payment.gatewayTransactionId,
                ),
            );

            console.log('✅ PAYMENT_EVENTS.SUCCESS emitted');
        } else {
            console.warn('❌ Emitting PAYMENT_EVENTS.FAILED');

            this.eventEmitter.emit(
                PAYMENT_EVENTS.FAILED,
                new PaymentFailedEvent(
                    payment._id,
                    payment.userId.id,
                    payment.amount,
                    'Payment failed',
                    payment.merchantOrderId,
                ),
            );

            this.eventEmitter.emit('alert.send', {
                userId: payment.userId,
                email: payment.userId?.email,
                mobile: payment.userId?.mobile,
                transactionId: payment.gatewayTransactionId,
                amount: payment.amount,
            });

            console.log('✅ PAYMENT_EVENTS.FAILED + alert.send emitted');
        }

        console.log('================ END handlePhonePeWebhook ================\n');
    }




    // ==================================================
    // 🔍 QUERIES
    // ==================================================
    async getPaymentById(paymentId: string, userId: Types.ObjectId) {
        const payment = await this.paymentModel.findOne({
            _id: paymentId,
            userId,
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        return payment;
    }

    async getUserPayments(userId: Types.ObjectId, limit = 10, skip = 0) {
        return this.paymentModel
            .find({ userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip)
            .exec();
    }


    async checkPaymentStatusAndFinalize(merchantOrderId: string) {
        const payment = await this.paymentModel.findOne({ merchantOrderId });
        if (!payment) throw new NotFoundException('Payment not found');

        // already finalized
        if (payment.status === 'success' && payment.webhookProcessed) {
            return { status: 'success', paymentId: payment._id };
        }

        const statusResponse = await this.phonePeGateway.verifyPayment(merchantOrderId);

        // normalize
        const normalizedStatus =
            statusResponse.status === 'success'
                ? 'success'
                : statusResponse.status === 'failed'
                    ? 'failed'
                    : 'pending';

        // update payment
        payment.status = normalizedStatus as any;
        payment.gatewayTransactionId = statusResponse.gatewayTransactionId;
        payment.gatewayResponse = statusResponse.gatewayResponse;

        if (normalizedStatus === 'success') {
            payment.paidAt = new Date();
            payment.webhookProcessed = true;

            await payment.save();

            // emit success → creates order
            this.eventEmitter.emit(
                PAYMENT_EVENTS.SUCCESS,
                new PaymentSuccessEvent(
                    payment._id,
                    payment.userId,
                    undefined,
                    payment.checkoutIntentId,
                    payment.amount,
                    payment.gatewayTransactionId,
                ),
            );

            return { status: 'success', paymentId: payment._id };
        }

        await payment.save();
        return { status: normalizedStatus, paymentId: payment._id };
    }

}