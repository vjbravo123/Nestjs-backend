import { 
  IsString, 
  IsNumber, 
  IsBoolean, 
  IsArray, 
  ValidateNested, 
  IsOptional, 
  IsEmail, 
  Matches, 
  ValidateIf 
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

class PricingTierDto {
  @IsString() tierName: string;
  @Type(() => Number) @IsNumber() pricePerPlate: number;
  @Type(() => Number) @IsNumber() minGuests: number;
  
  @IsArray() 
  @IsString({ each: true }) 
  includes: string[];
}

class VenueAreaDto {
  @IsString() areaName: string;
  @IsString() spaceType: string;
  @Type(() => Number) @IsNumber() seating: number;
  @IsOptional() @IsArray() @IsString({ each: true }) images?: string[];
}

class VenuePolicyDto {
  @IsString() type: string;
  @IsString() value: string;
  @IsString() description: string;
}

export class CreateVenueDto {
  @IsString() name: string;
  @IsString() type: string;
  @IsString() city: string;
  @IsString() address: string;
  @IsString() description: string;
  
  @IsOptional() 
  @ValidateIf(o => o.mapUrl !== '') 
  @IsString() 
  mapUrl?: string; 
  
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true) 
  @IsBoolean() 
  isActive?: boolean;

  @Type(() => Number) @IsNumber() capacityMin: number;
  @Type(() => Number) @IsNumber() capacityMax: number;
  @Type(() => Number) @IsNumber() startingRentalPrice: number;
  @Type(() => Number) @IsNumber() roomCount: number;
  @Type(() => Number) @IsNumber() roomPrice: number;
  @Type(() => Number) @IsNumber() yearStarted: number;
  
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true) 
  @IsBoolean() 
  allowsSmallParties?: boolean;

  @Type(() => Number) @IsNumber() destinationPackagePrice: number;
  @IsString() destinationPackageDescription: string;

  @IsArray() @ValidateNested({ each: true }) @Type(() => PricingTierDto) pricingTiers: PricingTierDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => VenueAreaDto) areas: VenueAreaDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => VenuePolicyDto) policies: VenuePolicyDto[];

  @IsOptional() images?: any[]; 
  
  @IsOptional()
  @ValidateIf(o => o.contactEmail !== '') 
  @IsEmail({}, { message: 'Invalid email address' }) 
  contactEmail?: string; 

  @IsOptional()
  @ValidateIf(o => o.contactPhone !== '') 
  @Matches(/^[0-9]{10}$/, { message: 'Phone must be exactly 10 digits' }) 
  contactPhone?: string; 

  @IsOptional()
  @IsArray() 
  @IsString({ each: true }) 
  @ValidateIf(o => o.amenities && o.amenities.length > 0) 
  amenities?: string[]; 
}