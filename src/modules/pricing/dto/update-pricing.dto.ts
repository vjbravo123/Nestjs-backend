import { IsBoolean, IsNumber, IsOptional, ValidateNested, IsString, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CustomFeeDto {
  @IsNumber() id: number;
  @IsString() name: string;
  @IsString() type: string;
  @IsNumber() value: number;
}

export class UpdateConfigDto {
  @IsOptional() @IsNumber() basePrice?: number;
  @IsOptional() @IsNumber() commissionRate?: number;
  @IsOptional() @IsNumber() pgRate?: number;
  @IsOptional() @IsNumber() gstRate?: number;
  @IsOptional() @IsBoolean() pgGstEnabled?: boolean;
  @IsOptional() @IsBoolean() commGstEnabled?: boolean;
  
  @IsOptional() 
  @IsArray() 
  @ValidateNested({ each: true }) 
  @Type(() => CustomFeeDto) 
  customFees?: CustomFeeDto[];
}

export class UpdatePricingDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateConfigDto)
  config?: UpdateConfigDto;
}