import { Types } from 'mongoose';

export class PaymentInitiatedEvent {
    constructor(
        public readonly paymentId: Types.ObjectId,
        public readonly userId: Types.ObjectId,
        public readonly amount: number,
        public readonly merchantTransactionId: string,
    ) { }
}

export class PaymentSuccessEvent {
    constructor(
        public readonly paymentId: Types.ObjectId,
        public readonly userId: Types.ObjectId,
        public readonly orderId?: Types.ObjectId,
        public readonly checkoutIntentId?: Types.ObjectId,
        public readonly amount?: number,
        public readonly gatewayTransactionId?: string,
    ) { }
}

export class PaymentFailedEvent {
    constructor(
        public readonly paymentId: Types.ObjectId,
        public readonly userId: Types.ObjectId,
        public readonly amount: number,
        public readonly reason: string,
        public readonly merchantTransactionId: string,
    ) { }
}

export class PaymentRefundedEvent {
    constructor(
        public readonly paymentId: Types.ObjectId,
        public readonly userId: Types.ObjectId,
        public readonly orderId: Types.ObjectId,
        public readonly refundedAmount: number,
        public readonly reason: string,
    ) { }
}

// Event names for consistency
export const PAYMENT_EVENTS = {
    INITIATED: 'payment.initiated',
    SUCCESS: 'payment.success',
    FAILED: 'payment.failed',
    REFUNDED: 'payment.refunded',
} as const;
