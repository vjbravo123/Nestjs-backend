import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCartBookingDto {
  @ApiProperty({
    example: '2025-12-25',
    description: 'Booking date for the event (ISO 8601 format)',
  })
  @IsDateString({}, { message: 'Invalid date format. Use ISO string (e.g. 2025-12-25).' })
  date: string;

  @ApiProperty({
    example: '18:30',
    description: 'Preferred time for the event in HH:mm format',
  })
  @IsString()
  @MinLength(3)
  time: string;

  @ApiProperty({
    example: {
      street: '123 Main Street',
      city: 'Mumbai',
      pincode: '400001',
    },
    required: false,
    description: 'Optional address where the service/event will be held',
  })
  @IsOptional()
  address?: Record<string, string>;
}
