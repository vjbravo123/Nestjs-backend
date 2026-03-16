import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TokenDocument = HydratedDocument<Token>;

@Schema({ timestamps: true })
export class Token {
  @Prop({ required: true, index: true })
  adminId: string;

  @Prop({ required: true, unique: true, index: true })
  jti: string;

  @Prop({ required: true })
  ip: string;

  @Prop()
  userAgent: string;

  @Prop({ required: true })
  refreshTokenHash: string;

  @Prop({ default: false, index: true })
  isRevoked: boolean;

  // TTL index: MongoDB will automatically delete expired token documents
  @Prop({ type: Date, expires: 0 })
  expiresAt: Date;
}

export const TokenSchema = SchemaFactory.createForClass(Token);
