import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Step 1 — vendor sends current GPS when tapping "I Have Arrived".
 * Backend validates they are within 200 m of the event venue.
 */
export class ArriveDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  longitude: number;
}

/**
 * Steps 3b & 5b — OTP submitted by vendor after client reads it aloud.
 * Used by both verify-start and verify-end endpoints.
 */
export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  otp: string;
}