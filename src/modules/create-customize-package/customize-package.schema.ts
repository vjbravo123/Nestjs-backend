import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class CustomizePackage extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  guestCount: string;

  @Prop({ required: true })
  preferredDate: string;

  @Prop({ required: true })
  budgetRange: string;

  @Prop({ type: [String], default: [] })
  modifications: string[];
}

export const CustomizePackageSchema = SchemaFactory.createForClass(CustomizePackage);