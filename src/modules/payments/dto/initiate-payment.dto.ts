import {
    IsEnum,
    IsMongoId,
    IsOptional,
    IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

/* ===============================
   Payment Method
================================ */
export enum PaymentMethod {
    UPI = 'upi',
    CARD = 'card',
    NETBANKING = 'netbanking',
    WALLET = 'wallet',
    OFFLINE = 'offline', // add if you support offline mode
}

/* ===============================
   Payment Option (Affects Pricing)
================================ */
export enum PaymentOption {
    MINIMUM = 'MINIMUM',   // System-calculated %
    CUSTOM = 'CUSTOM',     // User-defined %
    FULL = 'FULL',
    OFFLINE = 'OFFLINE'        // 100%
}


/* ===============================
   Initiate Payment DTO
================================ */
export class InitiatePaymentDto {

    /**
     * Checkout Intent ID
     * Used to fetch cart & freeze pricing snapshot
     */
    @IsMongoId()
    checkoutIntentId: string;

    /**
     * Payment option selected by user
     * FULL → 100%
     * CUSTOM → customPercent required
     */
    @IsOptional()
    @IsEnum(PaymentOption)
    paymentOption?: PaymentOption;

    /**
     * Required only if paymentOption = CUSTOM
     */
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    payAmountPercent?: number;


    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    totalPay?: number;

    /**
     * Optional platform hint
     */
    @IsOptional()
    @IsEnum(['web', 'android', 'ios'])
    platform?: 'web' | 'android' | 'ios';
}
