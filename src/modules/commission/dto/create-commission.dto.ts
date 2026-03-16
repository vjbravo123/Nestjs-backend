import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Types } from 'mongoose';
import { parseStringifiedArray } from '../../../common/utils/parse-stringified-array.util';
import { IsValidObjectId } from '../../../common/validators/is-valid-objectid.validator';


class FeeDto {
  @IsEnum(['percentage', 'flat'])
  type: 'percentage' | 'flat';

  @IsNumber()
  userCharge: number;

  @IsNumber()
  vendorCharge: number;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  includeGST?: boolean;
}

class GstDto {
  @IsNumber()
  userCharge: number;

  @IsNumber()
  vendorCharge: number;
}

class AdditionalChargeDto {
  @IsString()
  name: string;

  @IsNumber()
  amount: number;

  @IsEnum(['flat', 'percentage', 'expense'])
  chargeType: 'flat' | 'percentage' | 'expense';
}

class TierDto {
  @IsValidObjectId({ message: 'category must be a valid MongoDB ObjectId' })
  @Transform(({ value }) =>
    Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value,
  )
  @IsNotEmpty()
  tierId: Types.ObjectId;

  @IsString()
  tierName: string;

  @IsNumber()
  basePrice: number;

  @ValidateNested()
  @Type(() => FeeDto)
  platformFee: FeeDto;

  @ValidateNested()
  @Type(() => FeeDto)
  zappyCommission: FeeDto;

  @ValidateNested()
  @Type(() => FeeDto)
  gatewayFee: FeeDto;

  @ValidateNested()
  @Type(() => GstDto)
  gst: GstDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdditionalChargeDto)
  additionalCharges?: AdditionalChargeDto[];
}

export class CreateCommissionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TierDto)
  tiers: TierDto[];
}