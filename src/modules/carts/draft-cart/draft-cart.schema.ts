import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { mongooseGlobalTransformPlugin } from '../../../common/utils/mongoose-global-transform.plugin';
import { SlotType } from '../../vendoravailability/vendor-availability.schema';
import { calculateItemSubtotal } from '../utils/cart-price.utils';

export type DraftCartItemDocument = HydratedDocument<DraftCartItem>;

//
// -------------------------
//  Tier Snapshot (for main event)
// -------------------------
@Schema({ _id: false })
export class TierSnapshot {
    @Prop({ type: SchemaTypes.ObjectId, auto: true })
    _id?: Types.ObjectId;

    @Prop({ type: SchemaTypes.ObjectId, required: true })
    tierId: Types.ObjectId;

    @Prop()
    name?: string;

    @Prop({ required: true })
    price: number;

    @Prop()
    discount?: number;

    @Prop({ type: [String] })
    features?: string[];
}
export const TierSnapshotSchema = SchemaFactory.createForClass(TierSnapshot);

//
// -------------------------
//  Slot Selection (with quantity)
// -------------------------
@Schema({ _id: false })
export class SlotSelection {
    @Prop({
        type: String,
        enum: Object.values(SlotType),
        required: true,
    })
    slotType: SlotType;

    @Prop({ type: Number, default: 1, min: 1 })
    quantity: number;
}
export const SlotSelectionSchema = SchemaFactory.createForClass(SlotSelection);

//
// -------------------------
//  Tier with Slots (simplified)
// -------------------------
@Schema({ _id: false })
export class TierWithSlot {
    @Prop({ type: SchemaTypes.ObjectId, required: true })
    tierId: Types.ObjectId;



    @Prop()
    name?: string;

    @Prop({ required: true })
    price: number;

    @Prop({})
    discount?: number;

    @Prop({ type: [String], })
    features?: string[];


    @Prop({ type: [SlotSelectionSchema], default: [] })
    slots: SlotSelection[];
}
export const TierWithSlotSchema = SchemaFactory.createForClass(TierWithSlot);

//
// -------------------------
//  Addon Item (simplified - just IDs and slots)
// -------------------------
@Schema({ _id: false })
export class AddonItem {
    @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'AddOn' })
    addonId: Types.ObjectId;

    @Prop({ type: [String], default: [] })
    banner: string[];

    @Prop({ type: SchemaTypes.ObjectId, ref: 'Vendor', })
    assignAddonVendor?: Types.ObjectId;


    @Prop({ type: [TierWithSlotSchema], default: [] })
    tiersWithSlot: TierWithSlot[];
}
export const AddonItemSchema = SchemaFactory.createForClass(AddonItem);

//
// -------------------------
//  Draft Cart Item
// -------------------------
@Schema({ timestamps: true })
export class DraftCartItem {
    @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
    userId: Types.ObjectId;

    @Prop({ type: String })
    sessionId?: string;

    @Prop({
        required: true,
        enum: ['BirthdayEvent', 'ExperientialEvent', 'AddOn'],
    })
    eventCategory: string;

    @Prop({ type: SchemaTypes.ObjectId, required: true, refPath: 'eventCategory' })
    eventId: Types.ObjectId;

    @Prop({ type: SchemaTypes.ObjectId, ref: 'Vendor', default: null })
    assignVendor?: Types.ObjectId | null;

    @Prop()
    eventTitle?: string;


    @Prop({ type: Number, max: 100 })
    eventDiscount?: number;



    @Prop()
    city?: string;

    // MAIN EVENT TIER (single)
    @Prop({ type: TierSnapshotSchema })
    selectedTier?: TierSnapshot;

    @Prop()
    eventDate?: string;

    @Prop()
    eventTime?: string;

    @Prop()
    eventBookingDate?: Date;

    @Prop({ type: [AddonItemSchema], default: [] })
    addons: AddonItem[];

    @Prop({ type: SchemaTypes.ObjectId })
    addressId?: Types.ObjectId;

    @Prop({ type: Object })
    addressDetails: any;

    @Prop()
    plannerPrice?: number;

    @Prop({ default: false })
    isCompleted: boolean;

    @Prop({ default: 0 })
    subtotal: number;
}

export const DraftCartItemSchema = SchemaFactory.createForClass(DraftCartItem);

// Indexes
DraftCartItemSchema.index({ userId: 1 });
DraftCartItemSchema.index({ sessionId: 1 });
DraftCartItemSchema.plugin(mongooseGlobalTransformPlugin);

//
// -------------------------
// Subtotal calculation (looks up addon prices dynamically)
// -------------------------
// DraftCartItemSchema.pre('save', async function (next) {
//     try {
//         const basePrice = this.selectedTier?.price || 0;

//         // Calculate addon total by looking up prices from AddOn collection
//         let addonTotal = 0;
//         if (this.addons?.length) {
//             const AddOnModel = this.model('AddOn');

//             for (const addon of this.addons) {
//                 const addOnDoc: any = await AddOnModel.findById(addon.addonId)
//                     .select('tiers')
//                     .lean();

//                 if (addOnDoc?.tiers) {
//                     for (const tierWithSlot of addon.tiersWithSlot || []) {
//                         const tier = addOnDoc.tiers.find(
//                             (t: any) => t._id.toString() === tierWithSlot.tierId.toString()
//                         );
//                         if (tier) {
//                             const slotMultiplier = tierWithSlot.slots?.reduce(
//                                 (sum, slot) => sum + (slot.quantity || 1),
//                                 0
//                             ) || 1;
//                             addonTotal += tier.price * slotMultiplier;
//                         }
//                     }
//                 }
//             }
//         }

//         let subtotal = basePrice + addonTotal;

//         if (this.eventId && this.eventCategory) {
//             const EventModel = this.model(this.eventCategory);

//             const event: any = await EventModel.findById(this.eventId)
//                 .select('discount')
//                 .lean();

//             if (event?.discount && event.discount > 0) {
//                 const discountAmount = (basePrice * event.discount) / 100;
//                 subtotal = basePrice - discountAmount + addonTotal;
//             }
//         }

//         this.subtotal = Math.round(Number(subtotal));
//         next();
//     } catch (err) {
//         next(err);
//     }
// });

DraftCartItemSchema.pre('save', function (next) {
    try {
        // Reuse centralized pricing logic
        const subtotal = calculateItemSubtotal(this);

        // Store rounded subtotal
        this.subtotal = Math.round(subtotal);

        next();
    } catch (err) {
        next(err);
    }
});
