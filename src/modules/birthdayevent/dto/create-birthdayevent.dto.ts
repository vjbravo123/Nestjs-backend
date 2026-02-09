import {
    IsString,
    IsOptional,
    IsNumber,
    IsArray,
    ValidateNested,
    IsIn,
    ArrayMinSize,
    ArrayNotEmpty,
    IsBoolean,
    IsMongoId,
    IsEmpty,
    IsNotEmpty,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { parseStringifiedArray } from '../../../common/utils/parse-stringified-array.util';
import { ToBoolean } from 'src/common/utils/transFormTOBoolean';
import { ParseBoolean } from '../../../../src/common/utils/parseToBoolean';

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
export class CityDto {
    @IsNumber()
    @Type(() => Number)
    maxBookingsPerDay: number;

    @IsString()
    name: string;



}

export class CreateBirthdayEventDto {
    @IsString()
    title: string;

    @IsString()
    @IsIn(['kids', 'teens', 'adult', 'milestone'])
    ageGroup: string;
    @IsNumber()
    @Type(() => Number)
    duration: number;



    @IsArray()
    @IsString({ each: true })
    @Transform(parseStringifiedArray)
    @IsMongoId({ each: true })
    addOns: string[]; // Array of AddOn ObjectId strings

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CityDto)  // <-- very important for nested objects
    city: CityDto[];



    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    banner?: string[];

    @IsString()
    @IsOptional()
    description?: string;


    @IsOptional()
    @IsBoolean()
    @ParseBoolean()
    isShowcaseEvent?: boolean;

    @IsString()
    @IsOptional()
    @IsIn(['Popular Among Boys', 'Popular Among Girls', 'All-time Classics'])
    subCategory?: string;

    @IsArray()
    @Transform(parseStringifiedArray)
    coreActivity: string[];

    @IsOptional()
    @IsString()
    exclusion?: string;

    @IsBoolean()
    @IsOptional()
    active?: boolean;

    @IsArray({ message: 'Tiers must be an array' })
    @ArrayMinSize(1, { message: 'At least one tier is required' })
    @ValidateNested({ each: true })
    @Type(() => TierDto)
    @Transform(({ value }) => {
        // 1️⃣ Handle empty or null values early
        if (!value) return [];

        // 2️⃣ Handle case: value is a JSON string
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : [parsed];
            } catch {
                return [];
            }
        }

        // 3️⃣ Handle case: value is already an array
        if (Array.isArray(value)) {
            return value
                .map((item) => {
                    if (typeof item === 'string') {
                        try {
                            return JSON.parse(item);
                        } catch {
                            return null;
                        }
                    }
                    return item;
                })
                .filter((v) => v !== null && v !== undefined);
        }

        // 4️⃣ Default fallback
        return [];
    })
    tiers: TierDto[];

    @IsString()
    @IsOptional()
    tags?: string;


    @IsArray()
    @IsString({ each: true })
    @IsNotEmpty()
    @IsOptional()
    @Transform(parseStringifiedArray)
    delight?: string[];

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    discount?: number;
}

