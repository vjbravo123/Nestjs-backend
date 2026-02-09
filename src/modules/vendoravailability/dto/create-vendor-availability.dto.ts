import {
  IsArray,
  ArrayUnique,
  IsIn,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ✅ allowed weekdays
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

// ✅ allowed slot names (fixed time)
export const SLOT_TYPES = ['breakfast', 'lunch', 'tea', 'dinner'] as const;

export class CreateWeeklyDto {
  @IsArray()
  @ArrayUnique()
  @IsIn(WEEK_DAYS, { each: true })
  weeklyAvailableDays: string[];
}

/**
 * ✅ Weekly slots per weekday
 * Example:
 * {
 *   weeklySlots: [
 *     { day: "Mon", slots: ["breakfast","lunch"] },
 *     { day: "Tue", slots: ["tea","dinner"] }
 *   ]
 * }
 */
export class WeeklySlotEntryDto {
  @IsIn(WEEK_DAYS)
  day: string;

  @IsArray()
  @ArrayUnique()
  @IsIn(SLOT_TYPES, { each: true })
  slots: string[];
}

export class WeeklySlotsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeeklySlotEntryDto)
  weeklySlots: WeeklySlotEntryDto[];
}

export class OverrideDto {
  @IsDateString()
  date: string;

  @IsBoolean()
  isAvailable: boolean;

  // ✅ NEW: slot selection for that date override
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(SLOT_TYPES, { each: true })
  slots?: string[];

  @IsOptional()
  @IsString()
  reason?: string;
}

export class RangeDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsBoolean()
  isAvailable: boolean;

  // ✅ NEW: slot selection for range
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(SLOT_TYPES, { each: true })
  slots?: string[];

  @IsOptional()
  @IsString()
  reason?: string;
}
