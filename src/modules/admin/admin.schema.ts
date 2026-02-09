import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { mongooseGlobalTransformPlugin } from '../../common/utils/mongoose-global-transform.plugin';
import { UnauthorizedException } from '@nestjs/common';

export type AdminDocument = Admin & Document;

@Schema({ timestamps: true })
export class Admin {
    @Prop({ required: true, unique: true, lowercase: true, trim: true })
    email: string;

    @Prop({ required: true, minlength: 8, select: false })
    password: string;

    @Prop({ default: 'admin' })
    role: string;

    @Prop({ default: true })
    isActive: boolean;

    @Prop()
    lastLogin?: Date;

    @Prop({ default: 0 })
    failedLoginAttempts: number;

    @Prop()
    lockUntil?: Date;

    @Prop({ default: 0 })
    tokenVersion: number;

    @Prop({
        type: [
            {
                jti: { type: String, required: true },
                device: { type: String },
                ip: { type: String },
                issuedAt: { type: Date, default: Date.now },
            },
        ],
        default: [],
    })
    refreshTokens: Array<{
        jti: string;
        device: string;
        ip: string;
        issuedAt: Date;
    }>;
}

export const AdminSchema = SchemaFactory.createForClass(Admin);
// Do NOT use the global transform plugin here if you need instance methods
AdminSchema.plugin(mongooseGlobalTransformPlugin);

AdminSchema.methods.isPasswordMatch = async function (
    inputPassword: string
): Promise<boolean> {
    return bcrypt.compare(inputPassword, this.password);
};

AdminSchema.pre<AdminDocument>('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});