import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsDateString,
} from 'class-validator';

export class CreateInstallmentScheduleDto {

  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @IsNumber()
  totalAmount: number;

  @IsDateString()
  eventDate: string;

  @IsNumber()
  initialPaidAmount: number;

  @IsString()
  transactionId: string;
}
