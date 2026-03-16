import {
    IsOptional,
    IsString,
    IsEnum,
    IsNumber,
    IsDateString,
    IsBoolean,
    IsNumberString,
    IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';

import { Transform } from 'class-transformer';
import { Types } from 'mongoose';
import { IsValidObjectId } from '../../../common/validators/is-valid-objectid.validator';

export class UserInstallmentQueryDto {

    @IsValidObjectId({ message: 'checkout Batch Id must be a valid MongoDB ObjectId' })
    @Transform(({ value }) =>
        Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value,
    )
    @IsOptional()
    checkoutBatchId: Types.ObjectId;

    @IsOptional()
    @IsEnum(['pending', 'paid'])
    status?: 'pending' | 'paid';

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    minAmount?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    maxAmount?: number;

    @IsOptional()
    @IsDateString()
    fromDate?: string;

    @IsOptional()
    @IsDateString()
    toDate?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    limit?: number = 10;

    @IsOptional()
    @IsString()
    sortBy?: string = 'createdAt:desc';
}