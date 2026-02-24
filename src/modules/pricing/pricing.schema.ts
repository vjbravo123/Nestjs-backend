import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// 1. Custom Fee Sub-Schema 
@Schema({ _id: false })
export class CustomFee {
  @Prop({ required: true })
  id: number; 

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: ['fixed', 'percentage'] })
  type: string;

  @Prop({ required: true })
  value: number;
}
const CustomFeeSchema = SchemaFactory.createForClass(CustomFee);

// 2. Config Sub-Schema
@Schema({ _id: false }) 
export class PricingConfig {
  @Prop({ required: true, default: 0 })
  basePrice: number;

  @Prop({ required: true, default: 15 })
  commissionRate: number;

  @Prop({ required: true, default: 2.5 })
  pgRate: number;

  @Prop({ required: true, default: 18.0 })
  gstRate: number;

  @Prop({ required: true, default: true })
  pgGstEnabled: boolean;

  @Prop({ required: true, default: true })
  commGstEnabled: boolean;

  @Prop({ type: [CustomFeeSchema], default: [] })
  customFees: CustomFee[];
}

// 3. Main Document Schema
export type PricingDocument = Pricing & Document;

@Schema({ timestamps: true })
export class Pricing {
  @Prop({ type: Types.ObjectId, required: true, unique: true, ref: 'Addon' }) 
  serviceId: Types.ObjectId;

  @Prop({ type: PricingConfig, default: () => ({}) })
  config: PricingConfig;
}

export const PricingSchema = SchemaFactory.createForClass(Pricing);