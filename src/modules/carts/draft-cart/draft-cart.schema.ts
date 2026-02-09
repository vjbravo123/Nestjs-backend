import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { mongooseGlobalTransformPlugin } from '../../../common/utils/mongoose-global-transform.plugin'
export type DraftCartItemDocument = HydratedDocument<DraftCartItem>;

//
// -------------------------
//  Tier Snapshot
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

    @Prop({})
    discount?: number;
    @Prop({ type: [String], })
    features?: string[];
}
export const TierSnapshotSchema = SchemaFactory.createForClass(TierSnapshot);

//
// -------------------------
//  Addon Item
// -------------------------
@Schema({ _id: false })
export class AddonItem {
    @Prop({ type: SchemaTypes.ObjectId, auto: true })
    _id?: Types.ObjectId;

    @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'AddOn' })
    addOnId: Types.ObjectId;

    @Prop({ required: true })
    name: string;

    @Prop({ type: TierSnapshotSchema })
    selectedTier: TierSnapshot;
    @Prop({ type: SchemaTypes.ObjectId, ref: 'Vendor', })
    assignAddonVendor?: Types.ObjectId;
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

    // CATEGORY
    @Prop({
        required: true,
        enum: ['BirthdayEvent', 'ExperientialEvent', 'AddOn']
    })
    eventCategory: string;

    // EVENT
    @Prop({ type: SchemaTypes.ObjectId, required: true, refPath: 'eventCategory' })
    eventId: Types.ObjectId;
    @Prop({ type: SchemaTypes.ObjectId, ref: 'Vendor', default: null })
    assignVendor?: Types.ObjectId | null;


    @Prop()
    eventTitle?: string;

    // TIER
    @Prop({ type: TierSnapshotSchema })
    selectedTier?: TierSnapshot;

    // DATE & TIME
    @Prop()
    eventDate?: string;


    @Prop()
    city?: string;

    @Prop()
    eventTime?: string;
    @Prop()
    eventBookingDate?: Date;
    // ADDONS
    @Prop({ type: [AddonItemSchema], default: [] })
    addons: AddonItem[];

    // ADDRESS
    @Prop({ type: SchemaTypes.ObjectId })
    addressId?: Types.ObjectId;

    @Prop({ type: Object })
    addressDetails: any; // OR create a strict address schema
    @Prop()
    plannerPrice?: number;
    // META
    @Prop({ default: false })
    isCompleted: boolean;

    // AUTO CALCULATED SUBTOTAL
    @Prop({ default: 0 })
    subtotal: number;
}

export const DraftCartItemSchema = SchemaFactory.createForClass(DraftCartItem);

// Indexes
DraftCartItemSchema.index({ userId: 1 });
DraftCartItemSchema.index({ sessionId: 1 });
DraftCartItemSchema.plugin(mongooseGlobalTransformPlugin)


DraftCartItemSchema.pre('save', async function (next) {
    try {
        const basePrice = this.selectedTier?.price || 0;

        const addonTotal =
            this.addons?.reduce(
                (sum, addon) => sum + (addon?.selectedTier?.price || 0),
                0
            ) || 0;

        let subtotal = basePrice + addonTotal;

        // Fetch event using refPath
        if (this.eventId && this.eventCategory) {
            const EventModel = this.model(this.eventCategory); // ✅ FIXED

            const event: any = await EventModel.findById(this.eventId)
                .select('discount')
                .lean();

            if (event?.discount && event.discount > 0) {
                const discountAmount = (basePrice * event.discount) / 100;
                const discountedBasePrice = basePrice - discountAmount;

                subtotal = discountedBasePrice + addonTotal;
            }
        }

        // Remove floating point issues
        this.subtotal = Math.round(Number(subtotal));

        next();
    } catch (err) {
        next(err);
    }
});


