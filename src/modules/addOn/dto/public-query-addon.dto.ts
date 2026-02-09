import { IsOptional, IsDate, IsString, IsBoolean, IsNumberString } from 'class-validator';
import { Transform } from 'class-transformer';
import { Types } from 'mongoose';
import { IsValidObjectId } from '../../../common/validators/is-valid-objectid.validator';
export class PublicQueryAddOnDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsValidObjectId({ message: 'Created by must be a valid MongoDB ObjectId' })
    @Transform(({ value }) =>
        Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value,
    )
    @IsOptional()
    createdBy: Types.ObjectId;



    @IsValidObjectId({ message: 'category must be a valid MongoDB ObjectId' })
    @Transform(({ value }) =>
        Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value,
    )
    @IsOptional()
    category: Types.ObjectId;


    @IsString()
    @IsOptional()
    addOns: string;


    @IsString()
    @IsOptional()
    categoryId: string;


    @IsOptional()
    @IsDate()
    @Transform(({ value }) => (value ? new Date(value) : undefined))
    date?: Date;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @Transform(({ value }) => {
        if (value === 'true' || value === true) return true;
        if (value === 'false' || value === false) return false;
        return undefined;
    })
    @IsBoolean()
    popular?: boolean;

    @IsOptional()
    @IsNumberString()
    page?: number;

    @IsOptional()
    @IsNumberString()
    limit?: number;

    @IsOptional()
    @IsString()
    sortBy?: string; // e.g., 'createdAt:desc'
}
