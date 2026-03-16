import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { Types } from 'mongoose';
import { IsValidObjectId } from '../../../../common/validators/is-valid-objectid.validator';

export class UpdateDraftUpgradeEventTierDto {


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


}
