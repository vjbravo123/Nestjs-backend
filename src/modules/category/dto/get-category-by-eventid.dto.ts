import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { Types } from 'mongoose';
import { IsValidObjectId } from '../../../common/validators/is-valid-objectid.validator';




export enum EventTypeEnum {
    BIRTHDAY = 'BirthdayEvent',
    EXPERIENTIAL = 'ExperientialEvent',
    AddOn = 'AddOn',
}

export class CategoryByEventDto {

    @ApiProperty({
        example: '6734a1f56b2c3d001f9a1234',
        description: 'MongoDB ObjectId of the selected event',
    })
    @IsValidObjectId({ message: 'Event ID must be a valid MongoDB ObjectId' })
    @Transform(({ value }) =>
        Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value,
    )
    eventId: Types.ObjectId;

    @ApiProperty({
        example: 'birthdayEvent',
        enum: EventTypeEnum,
    })
    @IsString()
    @IsNotEmpty()
    @IsEnum(EventTypeEnum)
    eventType: EventTypeEnum;
}
