import { IsString, IsNotEmpty, IsNumber, IsEnum, IsOptional, IsDateString } from 'class-validator';

export class CreateHistoryDto {
    @IsString()
    @IsNotEmpty()
    orderId: string; 

    @IsNumber()
    @IsNotEmpty()
    totalAmount: number; 

    @IsDateString()
    @IsNotEmpty()
    eventDate: string; 

    @IsNumber()
    @IsNotEmpty()
    initialPaidAmount: number;

    @IsString()
    @IsNotEmpty()
    paymentMethod: string; 

    @IsString()
    @IsNotEmpty()
    transactionId: string; 
}