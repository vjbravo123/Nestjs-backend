import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class NotificationToken extends Document {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  token: string;

  @Prop({ enum: ['android', 'ios', 'web'], required: true })
  platform: 'android' | 'ios' | 'web';

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastUsedAt?: Date;
}

export const NotificationTokenSchema =
  SchemaFactory.createForClass(NotificationToken);
