import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class TalkToExpert extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  contactMethod: string;

  @Prop({ required: true })
  preferredTime: string;
}

export const TalkToExpertSchema = SchemaFactory.createForClass(TalkToExpert);