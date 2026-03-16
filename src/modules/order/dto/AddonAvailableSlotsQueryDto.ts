import { IsMongoId,IsOptional, IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { Types } from 'mongoose';
import { Type } from 'class-transformer';
import { IsValidObjectId } from '../../../common/validators/is-valid-objectid.validator';
export class AddonAvailableSlotsQueryDto {
     @IsValidObjectId({ message: 'Created by must be a valid MongoDB ObjectId' })
     @Transform(({ value }) =>
         Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value,
     )
     @IsOptional()
     eventId: Types.ObjectId;

  @IsString()
  city: string;

  // YYYY-MM-DD
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date: string;
}
