import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  Matches,
} from 'class-validator';
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

/**
 * Contact Method Enum
 */
export enum ContactMethod {
  CALL = 'call',
  WHATSAPP = 'whatsapp',
  EMAIL = 'email',
}

/**
 * Create Talk To Expert DTO
 */
export class CreateTalkToExpertDto {

  @IsEnum(EventCategory, {
    message: 'eventCategory must be BirthdayEvent, ExperientialEvent, or AddOn',
  })
  eventCategory: EventCategory;


  @IsValidObjectId({ message: 'Event ID must be a valid MongoDB ObjectId' })
  @Transform(({ value }) =>
    Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value,
  )
  eventId: Types.ObjectId;


  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '9876543210',
    description: 'Valid Indian mobile number',
  })
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Phone number must be a valid Indian mobile number',
  })
  phone: string;

  @ApiProperty({
    example: 'CALL',
    enum: ContactMethod,
  })
  @IsEnum(ContactMethod, {
    message: 'contactMethod must be CALL, WHATSAPP, or EMAIL',
  })
  contactMethod: ContactMethod;

  @ApiProperty({
    example: 'Evening 6 PM - 8 PM',
  })
  @IsString()
  @IsNotEmpty()
  preferredTime: string;
}
