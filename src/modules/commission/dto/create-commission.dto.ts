import { IsBoolean, IsNumber, IsOptional, ValidateNested, IsString, IsArray, IsDefined, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { AdditionalChargeDto, PricingSummaryDto } from './update-commission.dto'; 

export class StrictFeeConfigDto {
  @IsNotEmpty() @IsString() type: string;
  @IsNotEmpty() @IsNumber() userCharge: number;
  @IsNotEmpty() @IsNumber() vendorCharge: number;
}

export class StrictGatewayFeeConfigDto extends StrictFeeConfigDto {
  @IsOptional() @IsBoolean() includeGST?: boolean;
}

export class StrictGstConfigDto {
  @IsNotEmpty() @IsNumber() userCharge: number;
  @IsNotEmpty() @IsNumber() vendorCharge: number;
}

export class StrictTierConfigDto {
  @IsNotEmpty() @IsString() tierId: string;
  @IsNotEmpty() @IsString() tierName: string;
  @IsNotEmpty() @IsNumber() basePrice: number;

  @IsDefined() @ValidateNested() @Type(() => StrictFeeConfigDto)
  platformFee: StrictFeeConfigDto;

  @IsDefined() @ValidateNested() @Type(() => StrictGstConfigDto)
  gst: StrictGstConfigDto;

  @IsDefined() @ValidateNested() @Type(() => StrictGatewayFeeConfigDto)
  gatewayFee: StrictGatewayFeeConfigDto;

  @IsDefined() @ValidateNested() @Type(() => StrictFeeConfigDto)
  zappyCommission: StrictFeeConfigDto;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AdditionalChargeDto)
  additionalCharges?: AdditionalChargeDto[];

  @IsOptional() @IsNumber() totalAdditionalCharges?: number;

  @IsOptional() @ValidateNested() @Type(() => PricingSummaryDto)
  pricing?: PricingSummaryDto;
}

export class CreateCommissionDto {
  @IsOptional() @IsString() eventId?: string;
  @IsOptional() @IsString() serviceId?: string;

  @IsNotEmpty() @IsArray() @ValidateNested({ each: true }) @Type(() => StrictTierConfigDto)
  tiers: StrictTierConfigDto[];
}