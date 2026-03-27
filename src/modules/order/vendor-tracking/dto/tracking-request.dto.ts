import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  otp: string;
}
