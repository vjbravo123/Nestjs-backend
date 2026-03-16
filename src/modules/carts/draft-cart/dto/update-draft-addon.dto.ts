import { Type } from 'class-transformer';
import {
  IsArray,
  ValidateNested,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
  IsNumber,
  ArrayNotEmpty,
} from 'class-validator';

import {
  TransformToObjectId,
  IsValidObjectId,
} from 'src/common/validators/is-valid-objectid.validator';
import { Types } from 'mongoose';
import { SlotType } from '../../../vendoravailability/vendor-availability.schema';

import { IsTodayOrFuture } from './update-draft-schedule.dto'
//
// -------------------------
// Slot + Quantity
// -------------------------
export class SlotQuantityDto {
  @IsEnum(SlotType, {
    message: 'slotType must be breakfast, lunch, tea, or dinner',
  })
  slotType: SlotType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity?: number;
}

//
// -------------------------
// Tier with Slots
// -------------------------
export class TierWithSlotDto {
  @IsNotEmpty()
  @IsValidObjectId({ message: 'tierId must be a valid MongoDB ObjectId' })
  @TransformToObjectId()
  tierId: Types.ObjectId;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SlotQuantityDto)
  slots: SlotQuantityDto[];
}

//
// -------------------------
// Addon with Multiple Tiers
// -------------------------
export class DraftAddonInputDto {
  @IsNotEmpty()
  @IsValidObjectId({ message: 'addonId must be a valid MongoDB ObjectId' })
  @TransformToObjectId()
  addonId: Types.ObjectId;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => TierWithSlotDto)
  tiersWithSlot: TierWithSlotDto[];

  // optional future flag
  @IsOptional()
  @Type(() => Boolean)
  remove?: boolean;
}

//
// -------------------------
// Wrapper DTO
// -------------------------
export class UpdateDraftAddonsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => DraftAddonInputDto)
  addons: DraftAddonInputDto[];


  @IsOptional()
  @IsNotEmpty()
  @IsDateString({}, { message: 'eventDate must be a valid ISO date string' })
  @IsTodayOrFuture({ message: 'eventDate cannot be in the past' })
  eventDate?: string;

  @IsOptional()
  @IsNotEmpty()
  city?: string;

}
