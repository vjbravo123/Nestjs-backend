import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateCartCheckoutIntentDto {

    // 🛒 Cart identifier (ownership checked in service)
    @IsMongoId()
    cartId: string;

    // 🎟️ Optional coupon code
    @IsOptional()
    @IsString()
    couponCode?: string;
}
