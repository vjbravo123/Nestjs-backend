import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// 1.Config Sub-Schema
@Schema({ _id: false }) 
export class PricingConfig {
  @Prop({ required: true, default: 8500 })
  basePrice: number;

  @Prop({ required: true, default: 15 })
  commissionRate: number;

  @Prop({ required: true, default: 2.5 })
  pgRate: number;

  @Prop({ required: true, default: 18.0 })
  gstRate: number;

  @Prop({ required: true, default: 1.0 })
  tdsRate: number;

  @Prop({ required: true, default: true })
  pgGstEnabled: boolean;

  @Prop({ required: true, default: true })
  commGstEnabled: boolean;
}

// 2.AddOn Sub-Schema
@Schema()
export class AddOn {

  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ required: true, enum: ['fixed', 'percent'] })
  type: string;

  @Prop({ required: true })
  value: number;

  @Prop({ default: false })
  active: boolean;

  @Prop({ default: true })
  applyGst: boolean;
}

const AddOnSchema = SchemaFactory.createForClass(AddOn);

// 3.Main Document Schema
export type PricingDocument = Pricing & Document;

@Schema({ timestamps: true })
export class Pricing {
  @Prop({ type: PricingConfig, default: () => ({}) })
  config: PricingConfig;

  @Prop({ type: [AddOnSchema], default: [] })
  addOns: AddOn[];
}

export const PricingSchema = SchemaFactory.createForClass(Pricing);