import {
    Injectable,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID, createHash } from 'crypto';

import {
    StandardCheckoutClient,
    StandardCheckoutPayRequest,
    Env,
    MetaInfo,
    PhonePeException,
} from 'pg-sdk-node';

import {
    IPaymentGateway,
    PaymentInitiateRequest,
    PaymentInitiateResponse,
    PaymentWebhookPayload,
    PaymentStatusResponse,
    RefundRequest,
    RefundResponse,
} from '../interfaces/payment-gateway.interface';

@Injectable()
export class PhonePeGateway implements IPaymentGateway {
    private readonly logger = new Logger(PhonePeGateway.name);
    private readonly client: StandardCheckoutClient;
    private readonly isProd: boolean;

    constructor(private readonly config: ConfigService) {
        const clientId = this.config.get<string>('PHONEPE_CLIENT_ID');
        const clientSecret = this.config.get<string>('PHONEPE_CLIENT_SECRET');
        const clientVersion = Number(
            this.config.get<number>('PHONEPE_CLIENT_VERSION'),
        );

        console.log('📌 PhonePe ENV:', {
            NODE_ENV: this.config.get('NODE_ENV'),
            clientIdPresent: !!clientId,
            clientSecretPresent: !!clientSecret,
            clientVersion,
        });

        if (!clientId || !clientSecret || !clientVersion) {
            throw new Error('❌ PhonePe config missing');
        }

        this.isProd = this.config.get('NODE_ENV') === 'production';

        this.client = StandardCheckoutClient.getInstance(
            clientId,
            clientSecret,
            clientVersion,
            this.isProd ? Env.PRODUCTION : Env.SANDBOX,
        );

        this.logger.log(
            `✅ PhonePeGateway initialized | env=${this.isProd ? 'PRODUCTION' : 'SANDBOX'}`,
        );
    }

    /* ==================================================
     * 🔑 SHA256 helper
     * ================================================== */
    private sha256(text: string): string {
        return createHash('sha256').update(text).digest('hex');
    }

    /* ==================================================
     * 🟢 INITIATE PAYMENT
     * ================================================== */
    async initiatePayment(
        request: PaymentInitiateRequest,
    ): Promise<PaymentInitiateResponse> {
        console.log('➡️ initiatePayment request:', request);
        this.logger.log('➡️ initiatePayment called');

        try {
            const merchantOrderId = randomUUID();
            console.log('🆔 Generated merchantOrderId:', merchantOrderId);

            const metaInfo = MetaInfo.builder()
                .udf1(request.merchantTransactionId)
                .build();

            const payRequest = StandardCheckoutPayRequest.builder()
                .merchantOrderId(merchantOrderId)
                .amount(request.amount)
                .redirectUrl(request.callbackUrl)
                .metaInfo(metaInfo)
                .expireAfter(3600)
                .build();

            console.log('📤 PhonePe pay request built');

            const response = await this.client.pay(payRequest);

            console.log('📥 PhonePe pay response:', response);
            this.logger.log(`✅ Payment initiated | ${merchantOrderId}`);

            return {
                merchantOrderId,
                redirectUrl: response.redirectUrl,
                status: 'pending',
                message: 'PhonePe payment initiated',
            };
        } catch (err) {
            console.error('❌ initiatePayment error:', err);
            this.logger.error('❌ initiatePayment failed', err as any);

            throw new BadRequestException(
                (err as PhonePeException)?.message ??
                'PhonePe initiate failed',
            );
        }
    }

    /* ==================================================
     * 🔴 WEBHOOK (SOURCE OF TRUTH)
     * ================================================== */
    async handleWebhook(
        payload: any,
        authHeader?: string,
    ): Promise<PaymentWebhookPayload> {
        console.log('🔔 WEBHOOK RECEIVED');
        console.log('🔐 Auth header:', authHeader);
        console.log(
            '📦 Raw payload:',
            JSON.stringify(payload, null, 2),
        );

        this.logger.log('🔔 handleWebhook triggered');

        /* ================= DEV MODE ================= */
        if (!this.isProd) {
            this.logger.warn('⚠️ DEV MODE webhook bypass');
            console.log('⚠️ DEV MODE webhook bypass enabled');

            const merchantOrderId =
                payload?.payload?.merchantOrderId ||
                payload?.merchantOrderId;

            console.log('🆔 merchantOrderId:', merchantOrderId);

            if (!merchantOrderId) {
                throw new BadRequestException(
                    'DEV webhook missing merchantOrderId',
                );
            }

            const status =
                payload?.payload?.state === 'COMPLETED'
                    ? 'success'
                    : payload?.payload?.state === 'FAILED'
                        ? 'failed'
                        : 'pending';

            return {
                merchantOrderId,
                gatewayTransactionId:
                    payload?.payload?.paymentDetails?.[0]
                        ?.transactionId ?? 'DEV_TXN',
                status,
                amount: payload?.payload?.amount || payload?.amount,
                paymentMethod:
                    payload?.payload?.paymentDetails?.[0]
                        ?.paymentMode ?? 'DEV',
                rawPayload: payload,
            };
        }

        /* ================= PROD MODE ================= */
        try {
            this.logger.log('🔐 PROD webhook validation started');
            console.log('🔐 PROD webhook validation started');

            const username =
                this.config.get<string>('PHONEPE_WEBHOOK_USERNAME');
            const password =
                this.config.get<string>('PHONEPE_WEBHOOK_PASSWORD');

            console.log('🔑 Username present:', !!username);
            console.log('🔑 Password present:', !!password);

            if (!username || !password) {
                throw new BadRequestException(
                    'Webhook credentials missing',
                );
            }

            const receivedAuth = (authHeader || '').trim();
            const rawSecret = `${username}:${password}`;
            const expectedHash = this.sha256(rawSecret);

            console.log('📥 Received auth:', receivedAuth);
            console.log('📌 Expected RAW:', rawSecret);
            console.log('📌 Expected SHA256:', expectedHash);

            this.logger.log(`📥 Received auth: ${receivedAuth}`);
            this.logger.log(`📌 Expected SHA256: ${expectedHash}`);

            if (receivedAuth !== expectedHash) {
                console.error('❌ Auth mismatch');
                throw new BadRequestException(
                    'Invalid webhook authorization',
                );
            }

            console.log('✅ Webhook authorization verified');
            this.logger.log('✅ Webhook authorization verified');

            const event = payload?.event;
            const data = payload?.payload;

            console.log('📣 Event:', event);
            console.log('📦 Payload data:', data);

            if (!event || !data) {
                throw new BadRequestException(
                    'Invalid webhook structure',
                );
            }

            if (
                ![
                    'checkout.order.completed',
                    'checkout.order.failed',
                ].includes(event)
            ) {
                console.warn('⚠️ Unsupported event:', event);
                throw new BadRequestException(
                    `Unsupported event ${event}`,
                );
            }

            const merchantOrderId = data.merchantOrderId;
            if (!merchantOrderId) {
                throw new BadRequestException(
                    'merchantOrderId missing',
                );
            }

            const state = data.state;
            const status =
                state === 'COMPLETED'
                    ? 'success'
                    : state === 'FAILED'
                        ? 'failed'
                        : 'pending';

            console.log('📊 Final state:', state);
            console.log('📊 Final status:', status);

            this.logger.log(
                `✅ Webhook validated | ${merchantOrderId} | ${status}`,
            );

            return {
                merchantOrderId,
                gatewayTransactionId:
                    data?.paymentDetails?.[0]?.transactionId,
                status,
                amount: data.amount,
                paymentMethod:
                    data?.paymentDetails?.[0]?.paymentMode,
                rawPayload: payload,
            };
        } catch (err) {
            console.error('❌ Webhook validation failed:', err);
            this.logger.error(
                '❌ Webhook validation failed',
                err as any,
            );
            throw new BadRequestException(
                'Invalid PhonePe webhook',
            );
        }
    }

    /* ==================================================
     * 🔍 VERIFY PAYMENT
     * ================================================== */
    async verifyPayment(
        merchantOrderId: string,
    ): Promise<PaymentStatusResponse> {
        console.log('➡️ verifyPayment:', merchantOrderId);
        this.logger.log(`➡️ verifyPayment ${merchantOrderId}`);

        const response = await this.client.getOrderStatus(
            merchantOrderId,
        );

        console.log('📥 getOrderStatus response:', response);

        let status: PaymentStatusResponse['status'] =
            'pending';

        if (response.state === 'COMPLETED') status = 'success';
        else if (response.state === 'FAILED')
            status = 'failed';
        else if (response.state === 'PENDING')
            status = 'processing';

        console.log('📊 verifyPayment status:', status);

        return {
            merchantOrderId,
            gatewayTransactionId:
                response.paymentDetails?.[0]?.transactionId,
            status,
            amount: response.amount,
            currency: 'INR',
            paymentMethod:
                response.paymentDetails?.[0]?.paymentMode,
            gatewayResponse: response,
            paidAt:
                status === 'success' ? new Date() : undefined,
            failureReason:
                status === 'failed'
                    ? response.paymentDetails?.[0]?.errorCode
                    : undefined,
        };
    }

    /* ==================================================
     * 💸 REFUND
     * ================================================== */
    async refundPayment(
        _request: RefundRequest,
    ): Promise<RefundResponse> {
        this.logger.warn('⚠️ Refund not implemented');
        throw new BadRequestException(
            'Refund not implemented for PhonePe',
        );
    }
}
