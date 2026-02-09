import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsDateString, IsString } from 'class-validator';
import { Types } from 'mongoose';
import { IsValidObjectId, TransformToObjectId } from '../../../common/validators/is-valid-objectid.validator';
import { Transform } from 'class-transformer';
export class UpdateCartItemScheduleDto {

    @ApiProperty({
        example: '68b0366ece43a090df38cf50',
        description: 'MongoDB ObjectId of the cart item',
    })
    @IsNotEmpty()
    @IsValidObjectId({ message: 'cartItemId must be a valid MongoDB ObjectId' })
    @TransformToObjectId()
    cartItemId: Types.ObjectId;

    @ApiProperty({
        example: '2025-11-30',
        description: 'Updated event date in YYYY-MM-DD format',
    })
    @IsNotEmpty()
    @IsDateString({}, { message: 'eventDate must be a valid ISO date string' })
    eventDate: string;

    @ApiProperty({
        example: '06:30 PM',
        description: 'Updated event time',
    })
    @IsNotEmpty()
    @IsString({ message: 'eventTime must be a string' })
    eventTime: string;
}
