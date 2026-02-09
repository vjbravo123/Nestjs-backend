import { IsArray, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCustomizePackageDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  guestCount: string;

  @IsString()
  @IsNotEmpty()
  preferredDate: string;

  @IsString()
  @IsNotEmpty()
  budgetRange: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  modifications: string[];
}