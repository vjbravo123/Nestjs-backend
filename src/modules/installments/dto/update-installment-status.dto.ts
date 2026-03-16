import {
  IsString,
  IsNotEmpty,
  IsNumber,
} from 'class-validator';

export class UpdateInstallmentStatusDto {

  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @IsNumber()
  installmentNumber: number;

  @IsString()
  @IsNotEmpty()
  transactionId: string;
}
