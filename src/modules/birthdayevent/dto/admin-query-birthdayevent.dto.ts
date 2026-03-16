import { IsOptional, IsString, IsBoolean, IsNumber, Min, IsMongoId } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { IsValidObjectId } from '../../../common/validators/is-valid-objectid.validator';
import { Types } from 'mongoose';

export class AdminQueryBirthdayEventDto {
    // 🔍 Search by title or description
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

    // 🌆 Filter by city
    @IsOptional()
    @IsString()
    city?: string;

    // 🟢 Filter by verified status
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (value === 'true' || value === true) return true;
        if (value === 'false' || value === false) return false;
        return undefined;
    })
    isVerify?: boolean;

    // 🟢 Filter by active/inactive
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (value === 'true' || value === true) return true;
        if (value === 'false' || value === false) return false;
        return undefined;
    })
    active?: boolean;

    // ⭐ Filter showcase events
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (value === 'true' || value === true) return true;
        if (value === 'false' || value === false) return false;
        return undefined;
    })
    isShowcaseEvent?: boolean;

    // 👶 Filter by age group
    @IsOptional()
    @IsString()
    ageGroup?: string;

    // 🏷️ Filter by sub category
    @IsOptional()
    @IsString()
    subCategory?: string;

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
    select?: string; // e.g. "title,price,category"

    @IsOptional()
    @IsString()
    populate?: string; // e.g. "category,createdBy"

    @IsOptional()
    @IsString()
    cursor?: string; // For cursor-based pagination
}
