import {
    IsOptional,
    IsString,
    IsBoolean,
    IsMongoId,
    IsNumber,
    Min,
    IsIn,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { Types } from 'mongoose';
import { IsValidObjectId } from '../../../common/validators/is-valid-objectid.validator';

export class AdminQueryExperientialEventDto {
    // 🔍 Search by title
    @IsOptional()
    @IsString()
    title?: string;


    @IsOptional()
    @IsString()
    ageGroup?: string;

    // 🌆 Filter by city (single or multiple)
    @IsOptional()
    @Transform(({ value }) =>
        Array.isArray(value) ? value : value ? [value] : undefined,
    )
    city?: string[];

    // 🏷 Core activity
    @IsOptional()
    @IsString()
    coreActivity?: string;

    // 🟢 Active filter
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (value === 'true' || value === true) return true;
        if (value === 'false' || value === false) return false;
        return undefined;
    })
    isActive?: boolean;

    // ⭐ Showcase event
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (value === 'true' || value === true) return true;
        if (value === 'false' || value === false) return false;
        return undefined;
    })
    isShowcaseEvent?: boolean;

    // 📊 Total bookings filter
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    totalBookings?: number;

    // 🗂 Category
    @IsOptional()
    @IsMongoId({ message: 'experientialEventCategory must be valid ObjectId' })
    experientialEventCategory?: string;

    // 🗂 Sub Category (single or multiple)
    @IsOptional()
    @Transform(({ value }) =>
        Array.isArray(value) ? value : value ? [value] : undefined,
    )
    subExperientialEventCategory?: string[];

    // 👤 Created by
    @IsOptional()
    @IsValidObjectId({ message: 'CreatedBy must be valid MongoDB ObjectId' })
    @Transform(({ value }) =>
        Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value,
    )
    createdBy?: Types.ObjectId;

    // ✅ Verification filter
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (value === 'true' || value === true) return true;
        if (value === 'false' || value === false) return false;
        return undefined;
    })
    isVerify?: boolean;

    // 🕐 Update status
    @IsOptional()
    @IsIn(['pending', 'approved', 'rejected'])
    eventUpdateStatus?: 'pending' | 'approved' | 'rejected';

    // 💰 Price range (format: "100-500")
    @IsOptional()
    @IsString()
    priceRange?: string;

    // 📅 Event date (ISO string)
    @IsOptional()
    @IsString()
    eventDate?: string;

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
    limit = 10;

    // ↕️ Sorting
    @IsOptional()
    @IsString()
    sortBy?: string; // e.g. "createdAt:desc"

    // 🎯 Field selection
    @IsOptional()
    @IsString()
    select?: string;

    // 🔗 Population
    @IsOptional()
    @IsString()
    populate?: string;

    // 🔄 Cursor pagination
    @IsOptional()
    @IsString()
    cursor?: string;
}