import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class NotificationToken {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({
    required: true,
    index: true, // ❌ removed unique
  })
  token!: string;

  @Prop({
    enum: ['android', 'ios', 'web'],
    required: true,
  })
  platform!: 'android' | 'ios' | 'web';

  @Prop({ default: true })
  isActive!: boolean;

  @Prop()
  lastUsedAt?: Date;
}

export const NotificationTokenSchema =
  SchemaFactory.createForClass(NotificationToken);

/**
 * 🔥 Compound index
 * One token per user, prevents duplicates safely
 */
NotificationTokenSchema.index(
  { userId: 1, token: 1 },
  { unique: true },
);

export type NotificationTokenDocument =
  NotificationToken & Document;
