import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateAddOnDto {
  @IsNotEmpty() @IsString()
  name: string;

  @IsOptional() @IsString()
  description?: string;

  @IsNotEmpty() @IsEnum(['fixed', 'percent'])
  type: 'fixed' | 'percent';

  @IsNotEmpty() @IsNumber()
  value: number;

  @IsOptional() @IsBoolean()
  active?: boolean;

  @IsOptional() @IsBoolean()
  applyGst?: boolean;
}   