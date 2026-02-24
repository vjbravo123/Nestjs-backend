import { IsBoolean, IsNumber, IsOptional, ValidateNested, IsString, IsArray, IsDefined, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { AdditionalChargeDto, PricingSummaryDto } from './update-commission.dto'; 

export class StrictFeeConfigDto {
  @IsNotEmpty() @IsString() type: string;
  @IsNotEmpty() @IsNumber() userCharge: number;
  @IsNotEmpty() @IsNumber() vendorCharge: number;
  @IsNotEmpty() @IsBoolean() includeGST: boolean;
  @IsOptional() @IsNumber() userAmount?: number;
  @IsOptional() @IsNumber() vendorAmount?: number;
}

export class StrictGstConfigDto {
  @IsNotEmpty() @IsNumber() userCharge: number;
  @IsNotEmpty() @IsNumber() vendorCharge: number;
  @IsOptional() @IsNumber() userAmount?: number;
  @IsOptional() @IsNumber() vendorAmount?: number;
}

export class StrictGstTogglesDto {
  @IsNotEmpty() @IsBoolean() applyGstOnPlatformFee: boolean;
  @IsNotEmpty() @IsBoolean() applyGstOnGatewayFee: boolean;
  @IsNotEmpty() @IsBoolean() applyGstOnZappyCommission: boolean;
  @IsNotEmpty() @IsBoolean() applyGstOnAdditionalCharges: boolean;
}

export class CreateCommissionDto {
  @IsNotEmpty() @IsNumber() basePrice: number;
  @IsNotEmpty() @IsBoolean() includeGST: boolean;

  @IsDefined() @ValidateNested() @Type(() => StrictFeeConfigDto)
  platformFee: StrictFeeConfigDto;

  @IsDefined() @ValidateNested() @Type(() => StrictGstConfigDto)
  gst: StrictGstConfigDto;

  @IsDefined() @ValidateNested() @Type(() => StrictFeeConfigDto)
  gatewayFee: StrictFeeConfigDto;

  @IsDefined() @ValidateNested() @Type(() => StrictFeeConfigDto)
  zappyCommission: StrictFeeConfigDto;

  @IsDefined() @ValidateNested() @Type(() => StrictGstTogglesDto)
  gstToggles: StrictGstTogglesDto;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AdditionalChargeDto)
  additionalCharges?: AdditionalChargeDto[];

  @IsOptional() @IsNumber() totalAdditionalCharges?: number;

  @IsOptional() @ValidateNested() @Type(() => PricingSummaryDto)
  pricing?: PricingSummaryDto;
}