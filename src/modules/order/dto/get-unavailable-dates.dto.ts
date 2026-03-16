import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { Types } from 'mongoose';
import { IsValidObjectId } from '../../../common/validators/is-valid-objectid.validator';

export class GetUnavailableDatesDto {
    @IsValidObjectId({ message: 'eventId must be valid ObjectId' })
    @Type(() => Types.ObjectId)
    eventId: Types.ObjectId;

    @IsString()
    city: string;
    
    @IsString()
     eventType: string;

    @Type(() => Number)
    @IsInt()
    month: number;

    @Type(() => Number)
    @IsInt()
    year: number;
}
