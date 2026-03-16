import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { SlotType } from '../../vendoravailability/vendor-availability.schema';

export type VendorBookingDocument = HydratedDocument<VendorBooking>;

//
// =============================
// SLOT SNAPSHOT
// =============================
@Schema({ _id: false })
export class VendorSlotSnapshot {
    @Prop({
        type: String,
        enum: Object.values(SlotType),
        required: true,
    })
    slotType: SlotType;

    @Prop({ type: Number, default: 1 })
    quantity: number;
}

export const VendorSlotSnapshotSchema =
    SchemaFactory.createForClass(VendorSlotSnapshot);


//
// =============================
// TIER SNAPSHOT
// =============================
@Schema({ _id: false })
export class VendorTierSnapshot {
    @Prop({ type: SchemaTypes.ObjectId })
    tierId?: Types.ObjectId;

    @Prop()
    name?: string;

    @Prop({ type: Number })
    price?: number;

    @Prop({ type: [String], default: [] })
    features?: string[];

    @Prop({ type: [VendorSlotSnapshotSchema], default: [] })
    slots?: VendorSlotSnapshot[];
}

export const VendorTierSnapshotSchema =
    SchemaFactory.createForClass(VendorTierSnapshot);


//
// =============================
// MAIN VENDOR BOOKING
// =============================
@Schema({ timestamps: true })
export class VendorBooking {

    // Parent Order
    @Prop({
        type: SchemaTypes.ObjectId,
        ref: 'Order',
        required: true,
        index: true,
    })
    orderId: Types.ObjectId;

    // Order number snapshot (for vendor UI)
    @Prop({ required: true, index: true })
    orderNumber: string;

    // User snapshot (for vendor filters/support)
    @Prop({
        type: SchemaTypes.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    })
    userId: Types.ObjectId;

    // Checkout batch (grouped payment)
    @Prop({ type: SchemaTypes.ObjectId, index: true })
    checkoutBatchId: Types.ObjectId;

    // Vendor
    @Prop({
        type: SchemaTypes.ObjectId,
        ref: 'Vendor',
        required: true,
        index: true,
    })
    vendorId: Types.ObjectId;

    // event | addon
    @Prop({
        type: String,
        enum: ['event', 'addon'],
        required: true,
        index: true,
    })
    bookingType: 'event' | 'addon';

    // EventId or AddOnId
    @Prop({ type: SchemaTypes.ObjectId, required: true })
    itemId: Types.ObjectId;

    // BirthdayEvent | ExperientialEvent | AddOn
    @Prop({
        type: String,
        enum: ['BirthdayEvent', 'ExperientialEvent', 'AddOn'],
        required: true,
    })
    eventCategory: string;

    // Display title (event name / addon name)
    @Prop()
    title?: string;

    // Tier / slot snapshot
    @Prop({ type: VendorTierSnapshotSchema })
    tierSnapshot?: VendorTierSnapshot;

    // Schedule snapshot
    @Prop()
    eventDate?: string;

    @Prop({
        type: Date,
        default: Date.now,
    })
    eventBookingDate?: Date;
    @Prop()
    eventTime?: string;

    // Address snapshot
    @Prop({ type: Object })
    addressDetails?: any;

    // Amount for THIS vendor
    @Prop({ type: Number, required: true })
    amount: number;

    // Vendor booking lifecycle
    @Prop({
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'],
        default: 'pending',
        index: true,
    })
    status: string;

    // Payout lifecycle (future-proof)
    @Prop({
        type: String,
        enum: ['pending', 'released', 'paid'],
        default: 'pending',
        index: true,
    })
    payoutStatus: string;

    // Optional vendor note
    @Prop()
    vendorNote?: string;
}

export const VendorBookingSchema =
    SchemaFactory.createForClass(VendorBooking);


//
// =============================
// INDEXES
// =============================
VendorBookingSchema.index({ vendorId: 1, status: 1, eventDate: 1 });
VendorBookingSchema.index({ vendorId: 1, payoutStatus: 1 });
VendorBookingSchema.index({ orderId: 1 });
VendorBookingSchema.index({ checkoutBatchId: 1 });
VendorBookingSchema.index({ userId: 1 });
VendorBookingSchema.index({ orderNumber: 1 });
