import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { paginate } from '../../common/utils/paginate.plugin';
import { mongooseGlobalTransformPlugin } from '../../common/utils/mongoose-global-transform.plugin';

@Schema({ timestamps: true })
export class Coupon {
    @Prop({ required: true, unique: true })
    code: string;

    @Prop({ required: true, enum: ['percentage', 'fixed'] })
    discountType: 'percentage' | 'fixed'; // fixed = flat amount

    @Prop({ required: true })
    discountValue: number; // e.g. 20% or ₹500

    @Prop({ default: 0 })
    usageCount: number; // how many times coupon is used globally

    @Prop()
    maxUsage?: number; // total allowed usage across all users

    @Prop()
    minimumAmount?: number; // min order amount to apply coupon

    @Prop()
    userLimit?: number; // how many times a single user can use

    @Prop()
    maxDiscount?: number; // cap on percentage discount

    @Prop({ required: true })
    expiryDate: Date;

    @Prop({ default: true })
    isActive: boolean;

    // ✅ Event restrictions
    @Prop({ default: false })
    isGlobal: boolean; // if true, applies to all events

    @Prop({ type: [{ type: Types.ObjectId, ref: 'BirthDayEvent' }] })
    includeBirthDayEvents?: Types.ObjectId[]; // valid only for these events

    @Prop({ type: [{ type: Types.ObjectId, ref: 'BirthDayEvent' }] })
    excludeBirthDayEvents?: Types.ObjectId[]; // not valid for these events

    // ✅ User restrictions
    @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
    assignedUsers?: Types.ObjectId[]; // valid only for these users
}

export type CouponDocument = Coupon & Document;
export const CouponSchema = SchemaFactory.createForClass(Coupon);

// Plugins
CouponSchema.plugin(mongooseGlobalTransformPlugin);
CouponSchema.plugin(paginate);

// Indexes
CouponSchema.index({ code: 1 }, { unique: true });
