import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { mongooseGlobalTransformPlugin } from '../../common/utils/mongoose-global-transform.plugin';
import { paginate } from '../../common/utils/paginate.plugin';

// -------------------- Address Schema --------------------
@Schema()
export class Address {
    @Prop({ required: true })
    name: string;

    @Prop({ required: true })
    address: string;

    @Prop()
    street?: string;

    @Prop({ default: false })
    isDefault?: boolean;


    @Prop()
    landMark?: string;

    @Prop({ type: Number, min: 1000000000, max: 9999999999 })
    mobile?: number;

    @Prop({ required: true })
    city: string;

    @Prop({ required: true })
    state: string;

    @Prop({ required: true })
    pincode: number;

    @Prop({
        required: true,
        enum: ['home', 'office', 'other'],
        default: 'home',
    })
    addressType: string;

    @Prop()
    companyName?: string;

    @Prop()
    gstin?: string;

    @Prop({ type: Number })
    latitude?: number;

    @Prop({ type: Number })
    longitude?: number;
}

// -------------------- User Schema --------------------
@Schema({ timestamps: true })
export class User {
    // Step 1: Personal Info
    @Prop({ required: true, trim: true })
    firstName: string;

    @Prop({ required: true, trim: true })
    lastName: string;

    @Prop({ required: true, lowercase: true, trim: true })
    email: string;

    @Prop({ required: true, minlength: 6, select: false })
    password: string;

    @Prop({ type: Number, min: 1000000000, max: 9999999999, unique: true, sparse: true })
    mobile?: number;

    @Prop({ enum: ['user', 'admin', 'vendor'], default: 'user' })
    role: string;

    @Prop({ default: true })
    isActive?: boolean;

    @Prop({ type: Boolean, default: false })
    isVendor: boolean;

    @Prop({ default: false })
    isMobileVerify?: boolean;

    @Prop({ default: false })
    isEmailVerify?: boolean;

    @Prop({ default: false })
    agreeToTerms?: boolean;

    // Step 2: Address Info
    @Prop({ type: [SchemaFactory.createForClass(Address)], default: [] })
    addresses: Address[];

    // Auth & Session
    @Prop({ default: 0 })
    tokenVersion: number;

    @Prop()
    refreshToken?: string;

    @Prop({
        type: [
            {
                token: String,
                device: {
                    userAgent: String,
                    ip: String,
                },
                lastUsed: Date,
            },
        ],
        default: [],
    })
    activeSessions: Array<{
        token: string;
        device: {
            userAgent: string;
            ip: string;
        };
        lastUsed: Date;
    }>;

}

export type UserDocument = User & Document;

// -------------------- Factories --------------------
export const UserSchema = SchemaFactory.createForClass(User);
export const AddressSchema = SchemaFactory.createForClass(Address);

// -------------------- Indexes --------------------

UserSchema.index({ mobile: 1 }, { unique: true, sparse: true });

// -------------------- Plugins --------------------
UserSchema.plugin(mongooseGlobalTransformPlugin);
UserSchema.plugin(paginate);
