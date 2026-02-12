import { IsString, IsNotEmpty, IsNumber, IsEnum } from 'class-validator';

export class CreateHistoryDto {
    @IsString()
    @IsNotEmpty()
    checkoutIntentId: string;

    @IsNumber()
    @IsNotEmpty()
    totalAmount: number;

    @IsNumber()
    @IsNotEmpty()
    amountToPayNow: number;

    @IsEnum(['full', 'partial', 'custom', 'offline'])
    @IsNotEmpty()
    paymentPlan: string;
}