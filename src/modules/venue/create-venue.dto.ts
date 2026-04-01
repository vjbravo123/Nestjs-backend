import { IsString, IsNumber, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';

/* -------------------- nested DTOs -------------------- */

class PricingTierDto{
  @IsString() tierName:string;
  @Type(()=>Number) @IsNumber() pricePerPlate:number;
  @Type(()=>Number) @IsNumber() minGuests:number;
  @IsArray() @IsString({each:true}) includes:string[];
}

class VenueAreaDto{
  @IsString() areaName:string;
  @IsString() spaceType:string;
  @Type(()=>Number) @IsNumber() seating:number;
}

class VenuePolicyDto{
  @IsString() type:string;
  @IsString() value:string;
  @IsString() description:string;
}

/* -------------------- main DTO -------------------- */

export class CreateVenueDto{

  /* ---------- Basic Info ---------- */

  @IsString() name:string;
  @IsString() type:string;
  @IsString() city:string;
  @IsString() address:string;
  @IsString() description:string;
  @IsString() mapUrl:string;
  @Transform(({value})=>value==='true'||value===true) @IsBoolean() isActive:boolean;

  /* ---------- Capacity & Pricing ---------- */

  @Type(()=>Number) @IsNumber() capacityMin:number;
  @Type(()=>Number) @IsNumber() capacityMax:number;
  @Type(()=>Number) @IsNumber() startingRentalPrice:number;
  @Type(()=>Number) @IsNumber() roomCount:number;
  @Type(()=>Number) @IsNumber() roomPrice:number;
  @Type(()=>Number) @IsNumber() yearStarted:number;
  @Transform(({value})=>value==='true'||value===true) @IsBoolean() allowsSmallParties:boolean;
  @Type(()=>Number) @IsNumber() destinationPackagePrice:number;
  @IsString() destinationPackageDescription:string;

  /* ---------- Nested Arrays ---------- */

  @IsArray() @ValidateNested({each:true}) @Type(()=>PricingTierDto) pricingTiers:PricingTierDto[];
  @IsArray() @ValidateNested({each:true}) @Type(()=>VenueAreaDto) areas:VenueAreaDto[];
  @IsArray() @ValidateNested({each:true}) @Type(()=>VenuePolicyDto) policies:VenuePolicyDto[];

  /* ---------- Media & Contact ---------- */

  @IsArray() @IsString({each:true}) images:string[];
  @IsString() contactPhone:string;
  @IsString() contactEmail:string;
  @IsArray() @IsString({each:true}) amenities:string[];
}