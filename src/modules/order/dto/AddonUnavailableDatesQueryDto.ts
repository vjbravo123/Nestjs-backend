import { IsMongoId, IsOptional, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';


import { Transform } from 'class-transformer';
import { Types } from 'mongoose';
import { IsValidObjectId } from '../../../common/validators/is-valid-objectid.validator';
export class AddonUnavailableDatesQueryDto {





    @IsValidObjectId({ message: 'Created by must be a valid MongoDB ObjectId' })
    @Transform(({ value }) =>
        Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value,
    )
    @IsOptional()
    eventId: Types.ObjectId;

    @IsString()
    city: string;

    @Type(() => Number)
    @IsNumber()
    month: number;

    @Type(() => Number)
    @IsNumber()
    year: number;
}
