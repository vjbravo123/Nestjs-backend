import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Types } from 'mongoose';
import { IsValidObjectId } from '../../../common/validators/is-valid-objectid.validator';

export class AddToCartDto {
    @ApiProperty({
        example: 'birthday_event',
        enum: ['BirthdayEvent', 'ExperienceEvent', 'AddOn'],
        description: 'Category of the event (determines which collection to use)',
    })
    @IsEnum(['BirthdayEvent', 'ExperienceEvent', 'Addon'])
    eventCategory: 'BirthdayEvent' | 'ExperienceEvent' | 'Addon';

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
        example: '6734a1f56b2c3d001f9a5678',
        description: 'MongoDB ObjectId of the selected tier/package',
    })
    @IsValidObjectId({ message: 'Tier ID must be a valid MongoDB ObjectId' })
    @Transform(({ value }) =>
        Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value,
    )
    selectedTierId: Types.ObjectId;



    @ApiProperty({
        example: 'Luxury Birthday Experience',
        description: 'Snapshot name of the event for quick display',
        required: false,
    })
    @IsOptional()
    @IsString()
    eventTitle?: string;


}
