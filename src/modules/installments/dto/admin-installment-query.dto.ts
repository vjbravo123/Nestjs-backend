import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNumberString,
  IsDate,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Types } from 'mongoose';
import { IsValidObjectId } from '../../../common/validators/is-valid-objectid.validator';

export class InstallmentQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsValidObjectId({ message: 'User must be valid MongoDB ObjectId' })
  @Transform(({ value }) =>
    Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value,
  )
  userId?: Types.ObjectId;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDate()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  fromDate?: Date;

  @IsOptional()
  @IsDate()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  toDate?: Date;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsNumberString()
  page?: number;


  @IsValidObjectId({ message: 'checkout Batch Id must be a valid MongoDB ObjectId' })
  @Transform(({ value }) =>
    Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value,
  )
  @IsOptional()
  checkoutBatchId: Types.ObjectId;


  @IsOptional()
  @IsNumberString()
  limit?: number;

  @IsOptional()
  @IsString()
  sortBy?: string; // example: createdAt:desc
}
