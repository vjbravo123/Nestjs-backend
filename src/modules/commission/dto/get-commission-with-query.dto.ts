
import {
    IsArray,
    IsMongoId,
    IsNumber,
    IsString,
    IsOptional,
    ValidateNested,
    IsEnum,
    IsBoolean,
} from 'class-validator';
import { IsValidObjectId } from '../../../common/validators/is-valid-objectid.validator';
import {Types} from 'mongoose'
import { Transform, Type } from 'class-transformer';

export class GetTierQueryDto {
    @IsOptional()
    @IsValidObjectId({ message: 'tierId must be a valid MongoDB ObjectId' })
    @Transform(({ value }) =>
        Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value,
    )
    tierId?: Types.ObjectId;

    @IsOptional()
    @IsString()
    tierName?: string;
}