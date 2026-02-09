import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { mongooseGlobalTransformPlugin } from '../../common/utils/mongoose-global-transform.plugin';
import { paginate } from '../../common/utils/paginate.plugin';
import {
    TierSnapshot,
    TierSnapshotSchema,
    AddonItem,
    AddonItemSchema,
    AddressSnapshot,
    AddressSnapshotSchema,
} from '../carts/cart.schema';

export type CheckoutIntentDocument = HydratedDocument<CheckoutIntent>;

//
// -------------------------
// Checkout Item Snapshot
// -------------------------
@Schema({ _id: true })
export class CheckoutItemData {
    @Prop({ type: SchemaTypes.ObjectId, auto: true })
    _id: Types.ObjectId;

    @Prop({ type: SchemaTypes.ObjectId, refPath: 'eventCategory', required: true })
    eventId: Types.ObjectId;

    @Prop({
        required: true,
        enum: ['BirthdayEvent', 'ExperientialEvent', 'AddOn'],
    })
    eventCategory: string;

    @Prop({ required: true })
    eventTitle: string;

    @Prop({ type: TierSnapshotSchema, required: true })
    selectedTier: TierSnapshot;

    @Prop({ type: SchemaTypes.ObjectId, ref: 'Vendor', default: null })
    assignVendor?: Types.ObjectId | null;

    @Prop()
    timeSlot?: string;

    @Prop({ type: [AddonItemSchema], default: [] })
    addons: AddonItem[];

    @Prop()
    eventDate?: string;

    @Prop()
    eventTime?: string;

    @Prop({ type: Date })
    eventBookingDate?: Date;

    @Prop({ type: AddressSnapshotSchema, required: true })
    addressDetails: AddressSnapshot;

    @Prop({ required: true, min: 0 })
    subtotal: number;

    @Prop({ default: 0 })
    plannerPrice: number;

    @Prop({ type: [String], default: [] })
    banner?: string[];
}

export const CheckoutItemDataSchema =
    SchemaFactory.createForClass(CheckoutItemData);

//
// -------------------------
// Checkout Intent (MAIN)
// -------------------------
@Schema({
    timestamps: true,
})
export class CheckoutIntent {
    @Prop({
        type: SchemaTypes.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    })
    userId: Types.ObjectId;

    // Only for cart checkout
    @Prop({ type: SchemaTypes.ObjectId, ref: 'CartItem' })
    cartId?: Types.ObjectId;

    @Prop({
        type: [CheckoutItemDataSchema],
        required: true,
        validate: {
            validator: (v: any[]) => Array.isArray(v) && v.length > 0,
            message: 'Checkout must contain at least one item',
        },
    })
    items: CheckoutItemData[];

    // ---------- Pricing Snapshot ----------
    @Prop({ required: true, min: 0 })
    subtotal: number;

    @Prop({ default: 0, min: 0 })
    discount: number;

    @Prop({ required: true, min: 0 })
    totalAmount: number;

    // ---------- Coupon ----------
    @Prop()
    couponCode?: string;

    // ---------- Payment ----------
    @Prop({
        type: String,
        unique: true,
        sparse: true,
        index: true,
    })
    paymentId?: string;

    // ---------- Lifecycle ----------
    @Prop({
        type: String,
        enum: ['pending', 'paid', 'completed', 'failed', 'expired'],
        default: 'pending',
        index: true,
    })
    status: string;

    @Prop({
        type: String,
        enum: ['cart', 'direct'],
        required: true,
    })
    source: 'cart' | 'direct';

    // Back reference after order creation
    @Prop({ type: SchemaTypes.ObjectId, ref: 'Order' })
    orderId?: Types.ObjectId;

    // ⏳ TTL (auto delete)
    @Prop({ type: Date, expires: '24h', index: true })
    expiresAt: Date;
}

export const CheckoutIntentSchema =
    SchemaFactory.createForClass(CheckoutIntent);

// Plugins
CheckoutIntentSchema.plugin(mongooseGlobalTransformPlugin);
CheckoutIntentSchema.plugin(paginate);

// Indexes
CheckoutIntentSchema.index({ userId: 1, status: 1 });
CheckoutIntentSchema.index({ createdAt: 1 });
