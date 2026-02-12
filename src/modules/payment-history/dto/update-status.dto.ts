import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export class UpdateHistoryStatusDto {
    @IsString()
    @IsNotEmpty()
    checkoutIntentId: string;

    @IsString()
    @IsNotEmpty()
    milestoneName: string; 

    @IsEnum(['paid', 'failed'])
    @IsNotEmpty()
    status: string;

    @IsString()
    @IsOptional()
    transactionId?: string;
}