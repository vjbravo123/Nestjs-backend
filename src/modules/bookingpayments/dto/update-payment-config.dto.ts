import { IsBoolean, IsString, IsNumber, IsArray, ValidateNested, IsEnum, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class PartialPaymentDto {
  @IsBoolean()
  enabled: boolean;

  @IsNumber()
  bookingPercent: number;

  @IsNumber()
  daysThreshold: number;
}

class CustomSplitDto {
  @IsBoolean()
  enabled: boolean;

  @IsNumber()
  min: number;

  @IsNumber()
  max: number;

  @IsNumber()
  daysThreshold: number;
}

// --- NEW DTOs for Online Incentives ---
class PromoCodeSettingsDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  code: string;

  @IsNumber()
  amount: number;
}

class OnlineDiscountsDto {
  @IsBoolean()
  enabled: boolean;

  @IsNumber()
  standardFlat: number;

  @IsNumber()
  fullPaymentPercent: number;

  @ValidateNested()
  @Type(() => PromoCodeSettingsDto)
  promoCode: PromoCodeSettingsDto;
}
// --------------------------------------

class OfflineModeDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  instructions: string;
}

class CouponDto {
  @IsString()
  id: string;

  @IsString()
  code: string;

  @IsEnum(['percent', 'flat'])
  type: 'percent' | 'flat';

  @IsNumber()
  value: number;

  @IsNumber()
  usedCount: number;
}

export class UpdatePaymentConfigDto {
  // --- NEW Field ---
  @IsOptional()
  @ValidateNested()
  @Type(() => OnlineDiscountsDto)
  onlineDiscounts: OnlineDiscountsDto;
  // ----------------

  @ValidateNested()
  @Type(() => PartialPaymentDto)
  partialPayment: PartialPaymentDto;

  @ValidateNested()
  @Type(() => CustomSplitDto)
  customSplit: CustomSplitDto;

  @ValidateNested()
  @Type(() => OfflineModeDto)
  offlineMode: OfflineModeDto;

  @IsNumber()
  finalPaymentDueDays: number;

  @IsNumber()
  autoCancelUnpaidDays: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CouponDto)
  coupons: CouponDto[];
}