// dto/create-booking.dto.ts
import { IsString, IsNotEmpty, IsNumber, IsDateString, IsOptional, IsEmail, IsMongoId } from 'class-validator';

export class CreateBookingDto {
  @IsMongoId()
  @IsNotEmpty()
  clientId: string; // The ID of the User (client)

  @IsString()
  @IsNotEmpty()
  clientName: string;

  @IsEmail()
  @IsNotEmpty()
  clientEmail: string;

  @IsString()
  @IsOptional()
  clientPhone?: string;

  @IsString()
  @IsNotEmpty()
  eventType: string;

  @IsDateString()
  @IsNotEmpty()
  eventDate: Date;

  @IsString()
  @IsOptional()
  venue?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsNumber()
  @IsNotEmpty()
  totalAmount: number;
}