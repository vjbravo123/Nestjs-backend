import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsIn, Min, Max, IsBoolean } from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  landMark?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;



  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1000000000, { message: 'Mobile number must be exactly 10 digits' })
  @Max(9999999999, { message: 'Mobile number must be exactly 10 digits' })
  mobile?: number;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  pincode: number;

  @IsString()
  @IsNotEmpty()
  @IsIn(['home', 'office', 'other'])
  addressType: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  gstin?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;
}
