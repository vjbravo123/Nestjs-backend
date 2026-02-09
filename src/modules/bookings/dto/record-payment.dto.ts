import { IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';

export class RecordPaymentDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  // Ensure the string sent from frontend matches one of these
  @IsEnum(['UPI', 'Bank Transfer', 'Cheque', 'Cash', 'Credit Card'])
  mode: string;

  @IsString()
  reference: string;

  @IsString()
  adminName: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  milestoneId?: string; 
}