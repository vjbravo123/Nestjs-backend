import { IsNumber, IsNotEmpty, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class ResendOtpDto {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  mobile: number;

  @IsString()
  @IsNotEmpty()
  @IsIn(['user', 'vendor'])
  role: 'user' | 'vendor';
}

