import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { Types } from 'mongoose';
import { IsValidObjectId } from '../../../common/validators/is-valid-objectid.validator';


/**
 * Event Category Enum
 */
export enum EventCategory {
  BirthdayEvent = 'BirthdayEvent',
  ExperientialEvent = 'ExperientialEvent',
  AddOn = 'AddOn',
}

export class CreateCustomizePackageDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Matches(/^[6-9]\d{9}$/, {
    message: 'Phone number must be a valid Indian mobile number',
  })
  phone: string;

  @IsEmail()
  email: string;


  @IsEnum(EventCategory, {
    message: 'eventCategory must be BirthdayEvent, ExperientialEvent, or AddOn',
  })
  eventCategory: EventCategory;


  @IsValidObjectId({ message: 'Event ID must be a valid MongoDB ObjectId' })
  @Transform(({ value }) =>
    Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value,
  )
  eventId: Types.ObjectId;


  @Type(() => Number)
  @IsNumber()
  venueSizeCount: number;
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  preferredDate?: string;

  @IsString()
  @IsNotEmpty()
  budgetRange: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  modifications?: string[];
}
