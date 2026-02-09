import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TokenDocument = Token & Document;

@Schema({ timestamps: true })
export class Token {
    @Prop({ required: true })
    adminId: string;

    @Prop({ required: true })
    jti: string;

    @Prop({ required: true })
    ip: string;

    @Prop()
    userAgent: string;

    @Prop({ required: true })
    refreshTokenHash: string;

    @Prop({ default: false })
    isRevoked: boolean;

    @Prop()
    expiresAt: Date;
}

export const TokenSchema = SchemaFactory.createForClass(Token);