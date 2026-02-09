import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { paginate } from 'src/common/utils/paginate.plugin';
import { mongooseGlobalTransformPlugin } from 'src/common/utils/mongoose-global-transform.plugin';
export type OrderDocument = HydratedDocument<Order>;

//
// =============================
// EVENT SNAPSHOT (STRICT)
// =============================
@Schema({ _id: false })
export class OrderEventSnapshot {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  eventId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  eventTitle: string;

  @Prop({
    type: String,
    required: true,
    enum: ['BirthdayEvent', 'ExperientialEvent', 'AddOn'],
  })
  eventCategory: string;

  @Prop({ type: [String] })
  banner?: string[];
}
export const OrderEventSnapshotSchema =
  SchemaFactory.createForClass(OrderEventSnapshot);


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
  guest?: string;

  @Prop({ type: [String], })
  features?: string[];
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


  @Prop({ type: SchemaTypes.ObjectId, index: true })
  checkoutBatchId: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId, index: true })
  checkoutIntentId?: Types.ObjectId;

  // ORDER IDENTIFIER
  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
  })
  orderNumber: string;

  // EVENT SNAPSHOT
  @Prop({ type: OrderEventSnapshotSchema, required: true })
  event: OrderEventSnapshot;

  // SELECTED TIER SNAPSHOT
  @Prop({ type: OrderTierSnapshotSchema, required: true })
  selectedTier: OrderTierSnapshot;

  @Prop({ type: String })
  orderStatus: string;

  @Prop({ type: OrderAddressSnapshot, required: true })
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
    match: /^\d{4}-\d{2}-\d{2}$/, // yyyy-mm-dd
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
  @Prop({ type: Number, required: true, min: 0 })
  baseAmount: number;

  @Prop({ type: Number, min: 0 })
  addonsAmount: number;

  @Prop({ type: Number, required: true, min: 0 })
  subtotal: number;

  @Prop({ type: Number, min: 0 })
  discount: number;



  @Prop({ type: Number, required: true, min: 0 })
  totalAmount: number;

  // COUPON
  @Prop({ type: String })
  couponCode?: string;

  @Prop({ type: Object })
  couponSnapshot?: any;

  // PAYMENT
  @Prop({ type: String })
  paymentId?: string;

  @Prop({
    type: {
      method: String,
      // razorpay_order_id: String,
      // razorpay_payment_id: String,
      // razorpay_signature: String,
    },
  })
  paymentDetails: {
    method: string;
    // amount: number;
    // status: string;
    // razorpay_order_id?: string;
    // razorpay_payment_id?: string;
    // gatewayResponse?: any;
  };

  // STATUS
  @Prop({
    type: String,
    enum: [
      'pending',
      'payment_failed',
      'paid',
      'processing',
      'confirmed',
      'completed',
      'cancelled',
      'refunded',
    ],
    default: 'pending',
    index: true,
  })
  status: string;


}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.plugin(paginate)
OrderSchema.plugin(mongooseGlobalTransformPlugin)
//
// =============================
// INDEXES FOR SCALE
// =============================
OrderSchema.index({ userId: 1, status: 1, eventDate: 1 });
OrderSchema.index({ vendorId: 1, status: 1, eventDate: 1 });
OrderSchema.index({ createdAt: 1 });
OrderSchema.index({ orderNumber: 1 });
