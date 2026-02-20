import { IsBoolean, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateConfigDto {
  @IsOptional() @IsNumber() basePrice?: number;
  @IsOptional() @IsNumber() commissionRate?: number;
  @IsOptional() @IsNumber() pgRate?: number;
  @IsOptional() @IsNumber() gstRate?: number;
  @IsOptional() @IsNumber() tdsRate?: number;
  @IsOptional() @IsBoolean() pgGstEnabled?: boolean;
  @IsOptional() @IsBoolean() commGstEnabled?: boolean;
}

export class UpdatePricingDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateConfigDto)
  config?: UpdateConfigDto;
}