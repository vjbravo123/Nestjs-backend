import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { mongooseGlobalTransformPlugin } from '../../common/utils/mongoose-global-transform.plugin';
import { paginate } from '../../common/utils/paginate.plugin';

@Schema({ timestamps: true })
export class Auth {
    // Common mobile (used for both User and Vendor)
    @Prop({ type: Number, required: true, min: 1000000000, max: 9999999999 })
    mobile: number;

    // Current active role
    @Prop({ enum: ['user', 'vendor'], default: 'user' })
    currentRole: string;

    // All roles linked to this account
    @Prop({ type: [String], enum: ['user', 'vendor', 'admin'], default: ['user'] })
    roles: string[];

    // Relation references
    @Prop({ type: Types.ObjectId, ref: 'User', required: false })
    userId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Vendor', required: false })
    vendorId?: Types.ObjectId;

    // OTP login support
    @Prop({ type: String, required: false })
    otp?: string;

    @Prop({ type: Date, required: false })
    otpExpiry?: Date;

    // Password-based login (optional)
    @Prop({ select: false })
    password?: string;

    // Verification flags
    @Prop({ default: false })
    isMobileVerified: boolean;

    @Prop({ default: false })
    isEmailVerified: boolean;

    // Account state
    @Prop({ default: true })
    isActive: boolean;

    // Token versioning for force logout
    @Prop({ default: 0 })
    tokenVersion: number;

    /**
     * ✅ Active sessions for this Auth entity
     * Each session represents a device + refresh token combo.
     */
    @Prop({
        type: [
            {
                token: { type: String, required: true }, // hashed refresh token
                device: {
                    userAgent: { type: String, required: false },
                    ip: { type: String, required: false },
                },
                lastUsed: { type: Date, default: Date.now },
            },
        ],
        default: [],
    })
    activeSessions: Array<{
        token: string;
        device: {
            userAgent?: string;
            ip?: string;
        };
        lastUsed: Date;
    }>;

    // Last login time
    @Prop()
    lastLogin?: Date;
}

export type AuthDocument = Auth & Document;

export const AuthSchema = SchemaFactory.createForClass(Auth);

// 🔍 Indexes
AuthSchema.index({ mobile: 1 });
AuthSchema.index({ userId: 1 });
AuthSchema.index({ vendorId: 1 });

// 🔌 Plugins
AuthSchema.plugin(mongooseGlobalTransformPlugin);
AuthSchema.plugin(paginate);
