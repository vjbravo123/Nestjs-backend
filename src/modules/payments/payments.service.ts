import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
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
} from './events/payment.events';
import { UserDocument } from '../users/users.schema';

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
    ) { }

    // ==================================================
    // 🟢 INITIATE PAYMENT (IDEMPOTENT)
    // ==================================================
    // ==================================================
    async initiatePayment(userId: Types.ObjectId, dto: InitiatePaymentDto) {
        console.log('================ initiatePayment START ================');
        console.log('➡️ Request received');
        console.log('userId:', userId?.toString());
        console.log('checkoutIntentId:', dto.checkoutIntentId);

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
            console.log('merchantOrderId:', existing.merchantOrderId);

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
        console.log('FRONTEND_URL:', frontendUrl);

        if (!frontendUrl) {
            console.log('❌ FRONTEND_URL not configured');
            throw new BadRequestException('FRONTEND_URL not configured');
        }

        function encodeBookingId(batchId: string | number): string {
            console.log('🔐 encodeBookingId input:', batchId);
            const encoded = encodeURIComponent(
                Buffer.from(batchId.toString(), 'binary').toString('base64'),
            );
            console.log('🔐 encoded booking id:', encoded);
            return encoded;
        }

        function generateCallbackUrl(batchId: string | number): string {
            console.log('🔗 generateCallbackUrl input:', batchId);
            const encodedId = encodeBookingId(batchId);
            const url = `https://zappyeventz.com/dashboard/bookings/${encodedId}/payment-status`;
            console.log('🔗 generated callback URL:', url);
            return url;
        }

        const callbackUrl = generateCallbackUrl(intent._id.toString());
        console.log('✅ Final callback URL:', callbackUrl);

        // 🔐 Amount from DB (RUPEES)
        console.log('🔍 Step 4: Amount calculation');

        const amount = Number(intent.totalAmount);
        console.log('Amount from DB (₹):', amount);

        // 4️⃣ Merchant transaction ID
        console.log('🔍 Step 5: Generating merchant transaction ID');

        const merchantTransactionId = `${intent._id.toString()}_${Date.now()}`;
        console.log('merchantTransactionId:', merchantTransactionId);

        // ✅ Convert RUPEES → PAISE
        const amountInPaise = Math.round(amount * 100);
        console.log('Converted amount (paise):', amountInPaise);

        this.logger.log(
            `📡 PhonePe initiate | intentId=${intent._id} | merchantTxnId=${merchantTransactionId} | amount₹=${amount} | paise=${amountInPaise}`,
        );

        // 5️⃣ Call PhonePe
        console.log('📡 Step 6: Calling PhonePe initiate API');

        const gatewayResponse = await this.phonePeGateway.initiatePayment({
            amount: amountInPaise,
            merchantTransactionId,
            callbackUrl,
        });

        console.log('📨 PhonePe gateway response:', gatewayResponse);

        // 6️⃣ Save payment
        console.log('💾 Step 7: Saving payment in DB');

        const payment = await this.paymentModel.create({
            userId,
            checkoutIntentId: intent._id,
            amount, // RUPEES
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
            merchantOrderId: payment.merchantOrderId,
        });

        // 7️⃣ Emit event
        console.log('📢 Step 8: Emitting PAYMENT_INITIATED event');

        this.eventEmitter.emit(
            PAYMENT_EVENTS.INITIATED,
            new PaymentInitiatedEvent(
                payment._id,
                userId,
                payment.amount,
                payment.merchantOrderId,
            ),
        );

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
        console.log('📥 Raw webhook payload:', JSON.stringify(payload, null, 2));
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
