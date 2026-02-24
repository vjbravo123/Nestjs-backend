import { IsBoolean, IsNumber, IsOptional, ValidateNested, IsString, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class FeeConfigDto {
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsNumber() userCharge?: number;
  @IsOptional() @IsNumber() vendorCharge?: number;
  @IsOptional() @IsNumber() userAmount?: number;
  @IsOptional() @IsNumber() vendorAmount?: number;
  @IsOptional() @IsBoolean() includeGST?: boolean;
}

export class GstConfigDto {
  @IsOptional() @IsNumber() userCharge?: number;
  @IsOptional() @IsNumber() vendorCharge?: number;
  @IsOptional() @IsNumber() userAmount?: number;
  @IsOptional() @IsNumber() vendorAmount?: number;
}

export class AdditionalChargeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsString() chargeType?: string;
}

export class PricingSummaryDto {
  @IsOptional() @IsNumber() userPayment?: number;
  @IsOptional() @IsNumber() vendorPayout?: number;
  @IsOptional() @IsNumber() adminProfit?: number;
}

export class DiscountConfigDto {
  @IsOptional() @IsString() discountType?: string;
  @IsOptional() @IsNumber() useDiscount?: number;
  @IsOptional() @IsNumber() userDiscount?: number;
  @IsOptional() @IsNumber() vendorDiscount?: number;
}

export class GstTogglesDto {
  @IsOptional() @IsBoolean() applyGstOnPlatformFee?: boolean;
  @IsOptional() @IsBoolean() applyGstOnGatewayFee?: boolean;
  @IsOptional() @IsBoolean() applyGstOnZappyCommission?: boolean;
  @IsOptional() @IsBoolean() applyGstOnAdditionalCharges?: boolean;
}

export class UpdateCommissionDto {
  @IsOptional() @IsString() eventId?: string;
  @IsOptional() @IsString() serviceId?: string;
  
  @IsOptional() @IsNumber() basePrice?: number;
  @IsOptional() @IsBoolean() includeGST?: boolean;

  @IsOptional() @ValidateNested() @Type(() => FeeConfigDto)
  platformFee?: FeeConfigDto;

  @IsOptional() @ValidateNested() @Type(() => GstConfigDto)
  gst?: GstConfigDto;

  @IsOptional() @ValidateNested() @Type(() => FeeConfigDto)
  gatewayFee?: FeeConfigDto;

  @IsOptional() @ValidateNested() @Type(() => FeeConfigDto)
  zappyCommission?: FeeConfigDto;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AdditionalChargeDto)
  additionalCharges?: AdditionalChargeDto[];

  @IsOptional() @IsNumber() totalAdditionalCharges?: number;

  @IsOptional() @ValidateNested() @Type(() => PricingSummaryDto)
  pricing?: PricingSummaryDto;

  @IsOptional() @ValidateNested() @Type(() => DiscountConfigDto)
  discount?: DiscountConfigDto;

  @IsOptional() @ValidateNested() @Type(() => GstTogglesDto)
  gstToggles?: GstTogglesDto;
}