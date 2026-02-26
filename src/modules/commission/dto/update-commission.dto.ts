import { IsBoolean, IsNumber, IsOptional, ValidateNested, IsString, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class FeeConfigDto {
  @IsOptional() 
  @IsString() 
  type?: string;

  @IsOptional() 
  @IsNumber() 
  userCharge?: number;

  @IsOptional() 
  @IsNumber() 
  vendorCharge?: number;
}

export class GatewayFeeConfigDto extends FeeConfigDto {
  @IsOptional() 
  @IsBoolean() 
  includeGST?: boolean;
}

export class GstConfigDto {
  @IsOptional() 
  @IsNumber() 
  userCharge?: number;

  @IsOptional() 
  @IsNumber() 
  vendorCharge?: number;
}

export class AdditionalChargeDto {
  @IsOptional() 
  @IsString() 
  name?: string;

  @IsOptional() 
  @IsNumber() 
  amount?: number;

  @IsOptional() 
  @IsString() 
  chargeType?: string;
}

export class PricingSummaryDto {
  @IsOptional() 
  @IsNumber() 
  userPayment?: number;

  @IsOptional() 
  @IsNumber() 
  vendorPayout?: number;

  @IsOptional() 
  @IsNumber() 
  adminProfit?: number;
}

export class TierConfigDto {
  @IsOptional() 
  @IsString() 
  tierId?: string;

  @IsOptional() 
  @IsString() 
  tierName?: string;

  @IsOptional() 
  @IsNumber() 
  basePrice?: number;
  
  @IsOptional() 
  @ValidateNested() 
  @Type(() => FeeConfigDto) 
  platformFee?: FeeConfigDto;

  @IsOptional() 
  @ValidateNested() 
  @Type(() => GstConfigDto) 
  gst?: GstConfigDto;
  
  @IsOptional() 
  @ValidateNested() 
  @Type(() => GatewayFeeConfigDto) 
  gatewayFee?: GatewayFeeConfigDto;
  
  @IsOptional() 
  @ValidateNested() 
  @Type(() => FeeConfigDto) 
  zappyCommission?: FeeConfigDto;
  
  @IsOptional() 
  @IsArray() 
  @ValidateNested({ each: true }) 
  @Type(() => AdditionalChargeDto) 
  additionalCharges?: AdditionalChargeDto[];

  @IsOptional() 
  @IsNumber() 
  totalAdditionalCharges?: number;

  @IsOptional() 
  @ValidateNested() 
  @Type(() => PricingSummaryDto) 
  pricing?: PricingSummaryDto;
}

export class UpdateCommissionDto {
  @IsOptional() 
  @IsString() 
  eventId?: string;

  @IsOptional() 
  @IsString() 
  serviceId?: string;
  
  @IsOptional() 
  @IsArray() 
  @ValidateNested({ each: true }) 
  @Type(() => TierConfigDto)
  tiers?: TierConfigDto[];
}