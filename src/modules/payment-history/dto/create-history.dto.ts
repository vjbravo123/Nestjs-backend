import { IsString, IsNotEmpty, IsNumber, IsEnum, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class MilestoneDto {
    @IsString()
    @IsNotEmpty()
    @IsEnum([
        'Booking Token', 
        'First Installment', 
        'Second Installment', 
        'Final Balance', 
        'Full Payment', 
        'Security Deposit', 
        'Pay at Venue'
    ])
    name: string;

    @IsNumber()
    @IsNotEmpty()
    amount: number;

    @IsEnum(['pending', 'paid', 'failed', 'pay_at_venue'])
    @IsNotEmpty()
    status: string;

    @IsString()
    @IsOptional()   
    transactionId?: string;
}

export class CreateHistoryDto {
    @IsString()
    @IsNotEmpty()
    orderId: string; 

    @IsNumber()
    @IsNotEmpty()
    totalAmount: number;

    @IsEnum(['full', 'partial', 'custom', 'offline'])
    @IsNotEmpty()
    paymentPlan: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MilestoneDto)
    schedule: MilestoneDto[];
}