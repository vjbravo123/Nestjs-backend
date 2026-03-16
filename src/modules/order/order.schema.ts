import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { paginate } from 'src/common/utils/paginate.plugin';
import { mongooseGlobalTransformPlugin } from 'src/common/utils/mongoose-global-transform.plugin';
import { SlotType } from '../vendoravailability/vendor-availability.schema';


export enum OrderStatus {
  CREATED = 'created',
  CONFIRMED = 'confirmed',  ///FOR ONLINE PAYMENT
  IN_PROGRESS = 'in_progress',
  RESERVED = 'reserved',    // FOR  OFFLINE PAYMENT
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}


export enum PaymentStatus {
  PENDING = 'pending',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}
export type OrderDocument = HydratedDocument<Order>;

//
// =============================
// EVENT SNAPSHOT (STRICT)
// =============================
@Schema({ _id: false })
export class OrderEventSnapshot {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  eventId: Types.ObjectId;

  @Prop({ type: String, trim: true })
  eventTitle: string;

  @Prop({ type: Number })
  eventDiscount?: number;

  @Prop({
    type: String,
    required: true,
    enum: ['BirthdayEvent', 'ExperientialEvent', 'AddOn'],
  })
  eventCategory: string;

  @Prop({ type: [String], default: [] })
  banner?: string[];
}
export const OrderEventSnapshotSchema =
  SchemaFactory.createForClass(OrderEventSnapshot);

//
// =============================
// SLOT SNAPSHOT (STRICT)
// =============================
@Schema({ _id: false })
export class OrderSlotSnapshot {
  @Prop({
    type: String,
    required: true,
    enum: Object.values(SlotType),
  })
  slotType: string;

  @Prop({ type: Number, default: 1, min: 1 })
  quantity: number;
}

export const OrderSlotSnapshotSchema =
  SchemaFactory.createForClass(OrderSlotSnapshot);

//
// =============================
// TIER SNAPSHOT (STRICT)
// =============================
@Schema({ _id: false })
export class OrderTierSnapshot {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  tierId: Types.ObjectId;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: Number, required: true, min: 0 })
  price: number;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: String })
  venueSize?: string;

  @Prop({ type: [String], default: [] })
  features?: string[];

  // ✅ slot + quantity support
  @Prop({ type: [OrderSlotSnapshotSchema], default: [] })
  slots?: OrderSlotSnapshot[];
}

export const OrderTierSnapshotSchema =
  SchemaFactory.createForClass(OrderTierSnapshot);

//
// =============================
// ADDRESS SNAPSHOT (STRICT)
// =============================
@Schema({ _id: false })
export class OrderAddressSnapshot {
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

export const OrderAddressSnapshotSchema =
  SchemaFactory.createForClass(OrderAddressSnapshot);

//
// =============================
// ADDON SNAPSHOT (STRICT)
// =============================
@Schema({ _id: false })
export class OrderAddonSnapshot {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  addOnId: Types.ObjectId;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: OrderTierSnapshotSchema, required: true })
  selectedTier: OrderTierSnapshot;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Vendor',
    index: true,
  })
  addOnVendorId?: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  banner?: string[];

  @Prop({
    type: [String],
    enum: Object.values(SlotType),
    default: [],
  })
  slots?: SlotType[];
}

export const OrderAddonSnapshotSchema =
  SchemaFactory.createForClass(OrderAddonSnapshot);

//
// =============================
// MAIN ORDER SCHEMA (STRICT)
// =============================
@Schema({ timestamps: true })
export class Order {
  // USER
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  // OPTIONAL VENDOR ASSIGNMENT
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Vendor',
    index: true,
  })
  vendorId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId })
  checkoutBatchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, index: true })
  checkoutIntentId?: Types.ObjectId;

  // ORDER IDENTIFIER
  @Prop({
    type: String,
    required: true,
  })
  orderNumber: string;

  // EVENT SNAPSHOT
  @Prop({ type: OrderEventSnapshotSchema, required: true })
  event: OrderEventSnapshot;

  // SELECTED TIER SNAPSHOT
  @Prop({ type: OrderTierSnapshotSchema })
  selectedTier: OrderTierSnapshot;

  @Prop({
    type: String,
    enum: Object.values(OrderStatus),
    default: OrderStatus.CREATED,
  })
  orderStatus: OrderStatus;

  @Prop({ type: OrderAddressSnapshotSchema, required: true })
  addressDetails: OrderAddressSnapshot;

  // ADDONS SNAPSHOT
  @Prop({
    type: [OrderAddonSnapshotSchema],
    default: [],
    validate: {
      validator: (v: any[]) => Array.isArray(v),
      message: 'addons must be an array',
    },
  })
  addons: OrderAddonSnapshot[];

  // USER SELECTED DETAILS
  @Prop({
    type: String,
    match: /^\d{4}-\d{2}-\d{2}$/,
  })
  eventDate?: string;

  @Prop({
    type: Date,
    default: Date.now,
  })
  eventBookingDate?: Date;

  @Prop({ type: String })
  eventTime?: string;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Address',
  })
  addressId?: Types.ObjectId;

  // PRICING
  @Prop({ type: Number, min: 0 })
  baseAmount?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  addonsAmount: number;

  @Prop({ type: Number, required: true, min: 0 })
  subtotal: number;

  @Prop({ type: Number, min: 0, default: 0 })
  discount: number;

  @Prop({ type: Number, required: true, min: 0 })
  totalAmount: number;

  // COUPON
  @Prop({ type: String })
  couponCode?: string;

  @Prop({ type: Object })
  couponSnapshot?: any;

  // PAYMENT
  @Prop({
    type: String,
    enum: ['FULL', 'MINIMUM', 'CUSTOM', 'OFFLINE'],
    required: true,
  })
  paymentOption: string;



  @Prop({ type: Number, min: 0, max: 100 })
  payAmountPercent?: number;

  @Prop({ type: String })
  paymentId?: string;

  @Prop({
    type: {
      method: String,
    },
  })
  paymentDetails: {
    method: string;
  };

  // STATUS
  @Prop({
    type: String,
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.plugin(paginate);
OrderSchema.plugin(mongooseGlobalTransformPlugin);

//
// =============================
// INDEXES FOR SCALE
// =============================
OrderSchema.index({ userId: 1, orderStatus: 1, eventDate: 1 });
OrderSchema.index({ vendorId: 1, orderStatus: 1, eventDate: 1 });
OrderSchema.index({ userId: 1 });
OrderSchema.index({ checkoutBatchId: 1 });
OrderSchema.index({ orderStatus: 1 });
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ checkoutIntentId: 1 });
OrderSchema.index({ paymentId: 1 });
OrderSchema.index({ subtotal: 1 });
OrderSchema.index({ totalAmount: 1 });
OrderSchema.index({ orderNumber: 1 }, { unique: true });
OrderSchema.index({ createdAt: -1 }); // change to -1 for latest first
OrderSchema.index({
  orderNumber: "text",
  "event.eventTitle": "text",
  "event.eventCategory": "text",
  "addressDetails.name": "text",
  "addressDetails.address": "text",
  "addressDetails.city": "text",
  "addressDetails.state": "text"
});