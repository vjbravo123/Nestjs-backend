import {
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

/* -------------------- SUB DTOs -------------------- */

class OnlineDiscountDto {
  @IsBoolean()
  enabled: boolean;

  @IsNumber()
  amount: number;
}

class FullBonusDto {
  @IsBoolean()
  enabled: boolean;

  @IsNumber()
  percent: number;
}

class OfflineDto {
  @IsBoolean()
  enabled: boolean;

  @IsNumber()
  disableDays: number;
}

class PartialTierDto {
  @IsNumber()
  days: number;

  @IsNumber()
  percent: number;
}

class PartialPayDto {
  @IsBoolean()
  enabled: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartialTierDto)
  tiers: PartialTierDto[];
}

class CustomSplitDto {
  @IsBoolean()
  enabled: boolean;

  @IsNumber()
  availabilityDays: number;
}

/* -------------------- MAIN DTO -------------------- */

export class UpdatePaymentConfigDto {
  @ValidateNested()
  @Type(() => OnlineDiscountDto)
  onlineDiscount: OnlineDiscountDto;

  @ValidateNested()
  @Type(() => FullBonusDto)
  fullBonus: FullBonusDto;

  @ValidateNested()
  @Type(() => OfflineDto)
  offline: OfflineDto;

  @ValidateNested()
  @Type(() => PartialPayDto)
  partialPay: PartialPayDto;

  @ValidateNested()
  @Type(() => CustomSplitDto)
  customSplit: CustomSplitDto;
}
