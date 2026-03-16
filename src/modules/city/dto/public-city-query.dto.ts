import { IsOptional, IsBoolean, IsString, IsNumber } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class PublicCityQueryDto {
    /** ------------------------
     * SEARCH
     * ------------------------ */
    @IsOptional()
    @IsString()
    search?: string;

    /** ------------------------
     * ACTIVE FILTER
     * ------------------------ */
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (value === 'true' || value === true) return true;
        if (value === 'false' || value === false) return false;
        return undefined;
    })
    active?: boolean;


    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (value === 'true' || value === true) return true;
        if (value === 'false' || value === false) return false;
        return undefined;
    })
    isDeleted?: boolean;

    /** ------------------------
     * LOCATION FILTERS
     * ------------------------ */
    @IsOptional()
    @IsString()
    country?: string;

    @IsOptional()
    @IsString()
    state?: string;

    /** ------------------------
     * OFFSET PAGINATION
     * ------------------------ */
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    limit?: number;

    /** ------------------------
     * SORTING
     * ------------------------ */
    @IsOptional()
    @IsString()
    sortBy?: string;
    // examples:
    // city:asc
    // createdAt:desc

    /** ------------------------
     * CURSOR PAGINATION
     * ------------------------ */
    @IsOptional()
    @IsString()
    cursor?: string;
}
