import {
    IsString,
    IsOptional,
    IsNumber,
    IsArray,
    ValidateNested,
    IsIn,
    IsBoolean,
    IsMongoId,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { parseStringifiedArray } from '../../../common/utils/parse-stringified-array.util';

export class RangeDto {
    @IsNumber()
    @Type(() => Number)
    min: number;

    @IsNumber()
    @Type(() => Number)
    max: number;
}

export enum AgeGroup {
    KIDS = 'kids',
    TEENS = 'teens',
    ADULT = 'adult',
    MILESTONE = 'milestone',
}

export class TierDto {
    @IsNumber()
    @Type(() => Number)
    price: number;

    @IsString()
    name: string;

    @IsString()
    guest: string;

    @IsString()
    description: string;

    @IsArray()
    @IsString({ each: true })
    features: string[];
}

// ✅ Unified City DTO for both Create and Update
export class CityDto {
    @IsString()
    name: string;

    @IsNumber()
    @Type(() => Number)
    maxBookingsPerDay: number;
}

export class UpdateBirthdayEventDto {
    @IsString()
    @IsOptional()
    title?: string;

    @IsString()
    @IsOptional()
    @IsIn(['kids', 'teens', 'adult', 'milestone'])
    ageGroup?: string;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    duration?: number;

    @IsArray()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => CityDto)
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch {
                return [];
            }
        }
        return value;
    })
    city?: CityDto[];

    @IsArray()
    @IsOptional()
    @IsMongoId({ each: true })
    @Transform(parseStringifiedArray)
    addOns?: string[]; // Array of AddOn ObjectId strings

    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    banner?: string[];


    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    existingBanners?: string[];

    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    addBanner?: string[];
    @IsOptional()
    @IsString()
    exclusion?: string;
    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    @IsIn(['Popular Among Boys', 'Popular Among Girls', 'All-time Classics'])
    subCategory?: string;

    @IsArray()
    @IsOptional()
    @Transform(parseStringifiedArray)
    coreActivity?: string[];

    @IsBoolean()
    @IsOptional()
    active?: boolean;

    @IsArray()
    @IsOptional()
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
    tiers?: TierDto[];

    @IsString()
    @IsOptional()
    tags?: string;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    discount?: number;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    @Transform(parseStringifiedArray)
    delight?: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    removeBanners?: string[];
}
