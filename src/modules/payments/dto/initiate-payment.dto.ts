import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';

export enum PaymentMethod {
    UPI = 'upi',
    CARD = 'card',
    NETBANKING = 'netbanking',
    WALLET = 'wallet',
}

export class InitiatePaymentDto {
    /**
     * CheckoutIntent ID
     * Used to fetch amount & items securely from DB
     */
    @IsMongoId()
    checkoutIntentId: string;

    /**
     * Selected payment method (UI driven)
     */
    @IsEnum(PaymentMethod)
    paymentMethod: PaymentMethod;

    /**
     * Optional platform hint (future-proof)
     * ex: web | android | ios
     */
    @IsOptional()
    @IsString()
    platform?: 'web' | 'android' | 'ios';
}
