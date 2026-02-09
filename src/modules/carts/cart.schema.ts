import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { mongooseGlobalTransformPlugin } from '../../common/utils/mongoose-global-transform.plugin';
import { paginate } from '../../common/utils/paginate.plugin';
// import * as autopopulate from 'mongoose-autopopulate';
// ✅ Strong typing for Cart document
export type CartItemDocument = HydratedDocument<CartItem>;

//
// -------------------------
//  Tier Snapshot Embedded
// -------------------------
@Schema({ _id: false })
export class TierSnapshot {
    @Prop({ type: SchemaTypes.ObjectId, auto: true })
    _id?: Types.ObjectId;     // optional

    @Prop({ type: SchemaTypes.ObjectId, required: true })
    tierId: Types.ObjectId;

    @Prop()
    name?: string;

    @Prop({ required: true })
    price: number;



    @Prop({ type: [String], })
    features?: string[];

}


export const TierSnapshotSchema = SchemaFactory.createForClass(TierSnapshot);


//
// =============================
// ADDRESS SNAPSHOT (STRICT)
// =============================
@Schema({ _id: false })
export class AddressSnapshot {
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

export const AddressSnapshotSchema =
    SchemaFactory.createForClass(AddressSnapshot);


//
// -------------------------
//  Addon Embedded
// -------------------------

@Schema({ _id: false })
export class AddonItem {
    @Prop({ type: SchemaTypes.ObjectId, auto: true })
    _id?: Types.ObjectId;       // <-- Make OPTIONAL

    @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'AddOn' })
    addOnId: Types.ObjectId;

    @Prop({ required: true })
    name: string;


    @Prop({ type: SchemaTypes.ObjectId, ref: 'Vendor' })
    assignAddonVendor?: Types.ObjectId;

    @Prop({ type: TierSnapshot })
    selectedTier: TierSnapshot;
}


export const AddonItemSchema = SchemaFactory.createForClass(AddonItem);

//
// -------------------------
//  Cart Item Embedded
// -------------------------
@Schema({ _id: true })
export class CartData {
    @Prop({ type: SchemaTypes.ObjectId, auto: true })
    _id: Types.ObjectId;


    @Prop({ type: SchemaTypes.ObjectId, refPath: 'eventCategory', required: true })
    eventId: Types.ObjectId;


    @Prop({ type: SchemaTypes.ObjectId, ref: 'Vendor', default: null })
    assignVendor?: Types.ObjectId | null;


    @Prop({
        required: true,
        enum: ['BirthdayEvent', 'ExperientialEvent', 'AddOn'],
    })
    eventCategory: string; // Must match the Mongoose model name (e.g., 'BirthdayEvent')

    @Prop({ required: true })
    eventTitle: string;

    @Prop({ type: TierSnapshotSchema, required: true })
    selectedTier: TierSnapshot;



    @Prop()
    timeSlot?: string;

    @Prop({ type: [AddonItemSchema], default: [] })
    addons: AddonItem[];
    @Prop()
    eventDate?: string;

    @Prop()
    eventTime?: string;

    @Prop({ default: Date.now })
    eventBookingDate?: Date;

    @Prop({ default: 1 })
    isCheckOut?: number;

    @Prop({ type: SchemaTypes.ObjectId })
    addressId?: Types.ObjectId;

    @Prop({ type: AddressSnapshot, required: true })
    addressDetails: AddressSnapshot;

    @Prop({ default: 0 })
    plannerPrice: number;
    @Prop({ default: 0 })
    subtotal: number;
}

export const CartDataSchema = SchemaFactory.createForClass(CartData);



//
// -------------------------
//  Main Cart Schema
// -------------------------
@Schema({ timestamps: true, })
export class CartItem {
    @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
    userId: Types.ObjectId;

    @Prop({ type: String, index: true, sparse: true })
    sessionId?: string;

    @Prop({
        type: [
            {
                _id: { type: SchemaTypes.ObjectId, auto: true },
                eventId: { type: SchemaTypes.ObjectId, refPath: 'items.eventCategory', required: true },
                eventCategory: { type: String, enum: ['BirthdayEvent', 'ExperientialEvent', 'AddOn'], required: true },
                eventTitle: String,

                selectedTier: TierSnapshotSchema,
                assignVendor: { type: SchemaTypes.ObjectId, ref: 'Vendor' },
                timeSlot: String,
                addons: [AddonItemSchema],
                eventDate: String,
                isCheckOut: { type: Number, default: 1 },
                eventTime: String,
                eventBookingDate: Date,
                addressId: SchemaTypes.ObjectId,
                addressDetails: AddressSnapshotSchema,
                subtotal: Number,
                plannerPrice: Number,
                createdAt: Date,
                updatedAt: Date

            }
        ],
        default: []
    })
    items: CartData[];




    @Prop()
    couponCode?: string;

    @Prop({ default: false })
    termsAccepted?: boolean;

    @Prop({ default: 0 })
    totalAmount?: number;
    @Prop({ default: 'active', enum: ['active', 'checked_out', 'abandoned'], index: true })
    status: 'active' | 'checked_out' | 'abandoned';

    @Prop()
    cartLabel?: string;
}

export const CartItemSchema = SchemaFactory.createForClass(CartItem);

// ✅ Register plugins
CartItemSchema.plugin(mongooseGlobalTransformPlugin);
CartItemSchema.plugin(paginate);

// ✅ Indexes for performance
CartItemSchema.index({ userId: 1, status: 1 });
CartItemSchema.index({ sessionId: 1, status: 1 });
CartItemSchema.index({ 'items.eventId': 1 });

// Auto calculate subtotal and totalAmount before saving
CartItemSchema.pre('save', function (next) {
    try {
        this.items = this.items.map((item) => {
            const basePrice = item?.selectedTier?.price || 0;

            const addonTotal =
                item.addons?.reduce(
                    (sum, addon) => sum + (addon?.selectedTier?.price || 0),
                    0,
                ) || 0;

            item.subtotal = basePrice + addonTotal;
            return item;
        });

        this.totalAmount =
            this.items?.reduce((sum, item) => sum + (item.subtotal || 0), 0) || 0;

        next();
    } catch (err) {
        next(err);
    }
});