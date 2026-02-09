import {
    IsString,
    IsOptional,
    IsNumber,
    IsArray,
    IsEnum,
    ValidateNested,
    IsIn,
    IsBoolean,
    IsMongoId,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { parseStringifiedArray } from '../../../common/utils/parse-stringified-array.util';

export class RangeDto {
    @IsNumber()
    min: number;

    @IsNumber()
    max: number;
}



export class TierDto {
    @IsNumber()
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
    maxBookingsPerDay: number;

    @IsString()
    name: string;



}

export class CreateExperientialEventDto {
    @IsString()
    title: string;



    @IsString()
    experientialEventCategory: string;

    @IsString()
    @IsOptional()
    subExperientialEventCategory?: string;

    // @IsString()
    // @IsIn(['kids', 'teens', 'adult', 'milestone'])
    // ageGroup: string;

    @IsNumber()
    @Type(() => Number)
    duration: number;



    // @IsArray()
    // @IsString({ each: true })
    // @Transform(parseStringifiedArray)
    // @IsMongoId({ each: true })
    // @IsOptional()
    // addOns?: string[]; // Array of AddOn ObjectId strings

    // @IsArray()
    // @ValidateNested({ each: true })
    // @Type(() => CityDto)  // <-- very important for nested objects
    // city: CityDto[];


    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CityDto)  // <-- very important for nested objects
    city: CityDto[];


    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    @Transform(parseStringifiedArray)
    delight?: string[];

    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    banner?: string[];

    @IsString()
    @IsOptional()
    description?: string;

    @IsOptional()
    @IsString()
    exclusion?: string;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    isShowcaseEvent?: boolean;

    @IsString()
    @IsOptional()
    @IsIn(['Popular Among Boys', 'Popular Among Girls', 'All-time Classics'])
    subCategory?: string;

    @IsArray()
    @Transform(parseStringifiedArray)
    coreActivity: string[];






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

    @IsString()
    @IsOptional()
    tags?: string;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    discount?: number;
}


// --------------------


// --------------------
export class UpdateExperientialEventDto {
    @IsString()
    @IsOptional()
    title?: string;

    @IsArray()
    @IsString({ each: true })
    @Transform(parseStringifiedArray)
    @IsMongoId({ each: true })
    addOns: string[]; // Array of AddOn ObjectId strings

    @IsNumber()
    @Type(() => Number)
    duration: number;

    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    coreActivity?: string[];



    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    banner?: string[];

    @IsString()
    @IsOptional()
    description?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TierDto)
    @IsOptional()
    tiers?: TierDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CityDto)
    @IsOptional()
    city?: CityDto[];
}

// --------------------
export class AdminApprovalDto {
    @IsEnum(['approved', 'rejected'])
    action: 'approved' | 'rejected';

    @IsString()
    @IsOptional()
    reason?: string;
}


export class EventIdParamDto {
    @IsMongoId({ message: 'Invalid eventId: must be a valid MongoDB ObjectId' })
    eventId: string;
}