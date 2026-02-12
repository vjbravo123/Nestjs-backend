import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export class UpdateHistoryStatusDto {
    @IsString()
    @IsNotEmpty()
    orderId: string;

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