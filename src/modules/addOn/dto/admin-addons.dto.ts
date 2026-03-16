

import { IsOptional, IsString, IsBoolean, IsArray, ValidateNested, ValidateIf, IsIn, IsMongoId, IsNumber, Min, IsEnum } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { IsValidObjectId } from '../../../common/validators/is-valid-objectid.validator';
import { Types } from 'mongoose';
import { SlotType } from '../../vendoravailability/vendor-availability.schema';
// import { Type } from '@nestjs/common';

export class AdminApprovalDto {
  @IsString()
  @IsIn(['approved', 'rejected'])
  action: 'approved' | 'rejected';

  // ❗ reason is required only if action === 'rejected'
  @ValidateIf((o) => o.action === 'rejected')
  @IsString({ message: 'Reason is required ' })
  reason: string;
}



export class AdminQueryAddOnDto {
  // 🔍 Search by name or description
  @IsOptional()
  @IsString()
  search?: string;



  @IsValidObjectId({ message: 'Created by must be a valid MongoDB ObjectId' })
  @Transform(({ value }) =>
    Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value,
  )
  @IsOptional()
  createdBy: Types.ObjectId;



  // 🗂️ Filter by category ID
  @IsOptional()
  @IsMongoId({ message: 'category must be a valid MongoDB ObjectId' })
  category?: string;

  // 🌆 Filter by city (exact match or later partial search)
  @IsOptional()
  @IsString()
  city?: string;

  // 🟢 Filter by active/inactive
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })


  isVerify?: boolean;
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  isActive?: boolean;


  // ⭐ Filter popular add-ons
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  popular?: boolean;

  // 🕐 Filter by approval status
  @IsOptional()
  @IsString()
  updateStatus?: 'pending' | 'approved' | 'rejected';

  // 📄 Pagination
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit = 20;

  // ↕️ Sorting
  @IsOptional()
  @IsString()
  sortBy?: string; // e.g. "createdAt:desc" or "price:asc"



  @IsOptional()
  @IsString()
  select?: string; // e.g. "name,price,category"

  @IsOptional()
  @IsString()
  populate?: string; // e.g. "category,createdBy"

  @IsOptional()
  @IsString()

  cursor?: string; // For cursor-based pagination


}


export class RemoveBannerAddOnDto {
  @IsString()
  bannerToRemove: string;
}


class PendingTierDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  venueSize?: string;

  @IsOptional()
  @IsString()
  duration?: string;
  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  features?: string[];
}
class PendingSlotBookingDto {
  @IsOptional()
  @IsEnum(SlotType)
  slotType?: SlotType;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxSlotBookingsPerDay?: number;
}

class PendingCityDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PendingSlotBookingDto)
  slots?: PendingSlotBookingDto[];
}

export class UpdatePendingAddOnDto {


  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsValidObjectId({ message: 'category must be a valid MongoDB ObjectId' })
  @Transform(({ value }) =>
    Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value,
  )

  category: Types.ObjectId;
  @IsOptional()
  @IsArray()
  banner?: string[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PendingTierDto)
  tiers?: PendingTierDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PendingCityDto)
  cityOfOperation?: PendingCityDto[];
}
