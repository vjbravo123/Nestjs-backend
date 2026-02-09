import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Types } from 'mongoose';
import { parseStringifiedArray } from '../../../common/utils/parse-stringified-array.util';
import { IsValidObjectId } from '../../../common/validators/is-valid-objectid.validator';



export class TierDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  guest?: string;

  @IsString()
  @IsOptional()
  duration?: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  features: string[];
}
export class CityDto {
  @IsNumber()
  @Type(() => Number)
  maxBookingsPerDay: number;

  @IsString()
  name: string;



}

// 🎨 BannerDetails nested DTO
class BannerDetailDto {
  @IsString()
  @IsNotEmpty()
  image: string;

  @IsString()
  @IsOptional()
  title?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  order?: number;
}

export class CreateAddOnDto {
  // 🏷️ Add-on name
  @IsString()
  @IsNotEmpty()
  name: string;

  // 🖼️ Simple banner URLs
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  banner?: string[];

  // 🧩 Detailed banner objects
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => BannerDetailDto)
  bannerDetails?: BannerDetailDto[];

  // 🧾 Description
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  exclusion?: string;

  // 🗂️ Linked category (reference to Category model)
  @IsValidObjectId({ message: 'category must be a valid MongoDB ObjectId' })
  @Transform(({ value }) =>
    Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value,
  )
  @IsNotEmpty()
  category: Types.ObjectId;



  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TierDto)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const cleaned = value.trim().replace(/\n/g, '').replace(/\r/g, '').replace(/\s+/g, ' ');
        const parsed = JSON.parse(cleaned);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        console.error('Error parsing stringified tiers:', e);
        return [];
      }
    }

    if (Array.isArray(value)) {
      return value.map((item) => {
        if (typeof item === 'string') {
          try {
            return JSON.parse(item);
          } catch (e) {
            console.error('Failed to parse tier item:', item);
            return null;
          }
        }
        return item;
      }).filter(Boolean); // remove nulls
    }

    return [];
  })
  tiers: TierDto[];

  // 🔖 Tags for filtering
  @IsString()
  @IsNotEmpty()
  // tags: string;

  // 💰 Price per booking / item
  @Type(() => Number)
  // @IsNumber()
  @IsOptional()
  price?: number;

  // 🔢 Max number of bookings allowed per day
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  maxBookingsPerDay?: number;

  // 🏙️ Cities where this add-on is available
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CityDto)  // <-- very important for nested objects
  cityOfOperation: CityDto[];

  // ⏱️ Duration (e.g., "2h", "30min")
  @IsString()
  @IsOptional()
  duration?: string;

  // 📦 Maximum quantity per booking
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  maxQuantity?: number;

  // ✅ Active status
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // ⭐ Whether this add-on is popular
  @IsBoolean()
  @IsOptional()
  popular?: boolean;
}
