import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
class PricingTier {
  @Prop() tierName: string;
  @Prop() pricePerPlate: number;
  @Prop() minGuests: number;
  @Prop({ type: [String] }) includes: string[];
}

@Schema()
class VenueArea {
  @Prop() areaName: string;
  @Prop() spaceType: string; // indoor, outdoor, ballroom, etc.
  @Prop() seating: number;
}

@Schema()
class VenuePolicy {
  @Prop() type: string; // Catering, Decor, DJ, etc.
  @Prop() value: string;
  @Prop() description: string;
}

export type VenueDocument = Venue & Document;

@Schema({ timestamps: true })
export class Venue {
  // Basic Info
  @Prop({ required: true }) name: string;
  @Prop() type: string;
  @Prop() city: string;
  @Prop() address: string;
  @Prop() description: string;
  @Prop() mapUrl: string;
  @Prop({ default: true }) isActive: boolean;
  @Prop({ default: false }) isVerified: boolean;
  @Prop({ default: false }) isDeleted: boolean;


  // Capacity & Pricing Info
  @Prop() capacityMin: number;
  @Prop() capacityMax: number;
  @Prop() startingRentalPrice: number;
  @Prop() roomCount: number;
  @Prop() roomPrice: number;
  @Prop() yearStarted: number;
  @Prop({ default: false }) allowsSmallParties: boolean;
  @Prop() destinationPackagePrice: number;
  @Prop() destinationPackageDescription: string;

  // Nested Arrays
  @Prop({ type: [SchemaFactory.createForClass(PricingTier)] })
  pricingTiers: PricingTier[];
  @Prop({ type: [SchemaFactory.createForClass(VenueArea)] }) areas: VenueArea[];
  @Prop({ type: [SchemaFactory.createForClass(VenuePolicy)] })
  policies: VenuePolicy[];

  // Media & Contact
  @Prop({ type: [String] }) images: string[];
  @Prop() contactPhone: string;
  @Prop() contactEmail: string;
  @Prop({ type: [String] }) amenities: string[];



}

export const VenueSchema = SchemaFactory.createForClass(Venue);


