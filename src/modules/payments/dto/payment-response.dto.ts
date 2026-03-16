import { PaymentStatus } from '../interfaces/payment-gateway.interface';

/* ----------------------------------------------------
 * Payment Initiation Response
 * -------------------------------------------------- */
export class PaymentResponseDto {
    /** Internal DB payment id */
    paymentId: string;

    /** Merchant Order ID (PRIMARY KEY for PhonePe & gateways) */
    merchantOrderId: string;

    /** Amount in paisa */
    amount: number;

    currency: 'INR';

    status: PaymentStatus;

    /** PhonePe checkout URL */
    redirectUrl?: string;

    /** Future gateways (UPI QR / Deep link) */
    qrCode?: string;
    deepLink?: string;

    message?: string;
}

/* ----------------------------------------------------
 * Payment Status Response
 * -------------------------------------------------- */
export class PaymentStatusDto {
    /** Merchant Order ID */
    merchantOrderId: string;

    status: PaymentStatus;

    amount: number;
    currency: 'INR';

    paymentMethod?: string;
    paidAt?: Date;
    failureReason?: string;
}
