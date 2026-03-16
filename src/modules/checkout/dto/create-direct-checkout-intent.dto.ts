import { IsNotEmpty, IsOptional, IsString, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { CheckoutItem } from '../interfaces/checkout-item.interface';

export class CreateDirectCheckoutIntentDto {




    // 🎟️ Optional coupon
    @IsOptional()
    @IsString()
    couponCode?: string;
}
