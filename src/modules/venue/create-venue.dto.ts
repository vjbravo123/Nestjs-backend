import {
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  IsOptional,
  ValidateNested
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

/* -------------------- nested DTOs -------------------- */

class PricingTierDto {

  @IsString()
  tierName: string;

  @Type(() => Number)
  @IsNumber()
  pricePerPlate: number;

  @Type(() => Number)
  @IsNumber()
  minGuests: number;

  @IsArray()
  @IsString({ each: true })
  includes: string[];
}

class VenueAreaDto {

  @IsString()
  areaName: string;

  @IsString()
  spaceType: string;

  @Type(() => Number)
  @IsNumber()
  seating: number;

}

class VenuePolicyDto {

  @IsString()
  type: string;

  @IsString()
  value: string;

  @IsString()
  description: string;
}


/* -------------------- main DTO -------------------- */

export class CreateVenueDto {

  /* ---------- Basic Info ---------- */

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  city: string;

  @IsOptional()
  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  mapUrl: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isVerified: boolean;


  /* ---------- Capacity & Pricing ---------- */

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  capacityMin: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  capacityMax: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  startingRentalPrice: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  roomCount: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  roomPrice: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  yearStarted: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  allowsSmallParties: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  destinationPackagePrice: number;

  @IsOptional()
  @IsString()
  destinationPackageDescription: string;


  /* ---------- Nested Arrays ---------- */

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingTierDto)
  pricingTiers: PricingTierDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VenueAreaDto)
  areas: VenueAreaDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VenuePolicyDto)
  policies: VenuePolicyDto[];


  /* ---------- Media & Contact ---------- */

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images: string[];

  @IsOptional()
  @IsString()
  contactPhone: string;

  @IsOptional()
  @IsString()
  contactEmail: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities: string[];
}