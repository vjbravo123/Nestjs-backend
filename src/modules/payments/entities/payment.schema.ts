import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { UserDocument } from '../../users/users.schema';

export type PaymentDocument = Payment & Document;

export type PaymentWithUser = PaymentDocument & {
  userId: UserDocument;
};

export type PaymentStatus =
  | 'initiated'
  | 'pending'
  | 'processing'
  | 'success'
  | 'failed'
  | 'refunded'
  | 'cancelled';

export type PaymentMode =
  | 'UPI_QR'
  | 'UPI_INTENT'
  | 'CARD'
  | 'NET_BANKING'
  | 'UPI_COLLECT'
  | 'UPI'
  | 'WALLET'
  | 'UNKNOWN';

@Schema({ timestamps: true })
export class Payment {
  _id: Types.ObjectId;

  /* ===================== CORE REFERENCES ===================== */

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CheckoutIntent' })
  checkoutIntentId?: Types.ObjectId;

  /* ===================== AMOUNT ===================== */

  /** Amount in INR (or paisa if you prefer — stay consistent) */
  @Prop({ required: true })
  amount: number;

  @Prop({ default: 'INR' })
  currency: string;

  @Prop()
  feeAmount?: number;

  /* ===================== STATUS ===================== */

  @Prop({
    enum: [
      'initiated',
      'pending',
      'processing',
      'success',
      'failed',
      'refunded',
      'cancelled',
    ],
    default: 'initiated',
  })
  status: PaymentStatus;

  /* ===================== GATEWAY ===================== */

  @Prop({ enum: ['phonepe', 'razorpay', 'stripe'], default: 'phonepe' })
  gateway: string;

  /** PhonePe merchantOrderId (PRIMARY KEY) */
  @Prop({ required: true, unique: true })
  merchantOrderId: string;

  /** Your internal paymentId / intentId */
  @Prop({ required: true })
  merchantTransactionId: string;

  /** PhonePe transactionId */
  @Prop({ sparse: true })
  gatewayTransactionId?: string;

  /* ===================== PAYMENT MODE ===================== */

  @Prop({
    enum: ['UPI_QR', 'UPI_INTENT', 'CARD', 'NET_BANKING', 'WALLET', , 'UPI_COLLECT', 'UNKNOWN','UPI'],
    default: 'UNKNOWN',
  })
  paymentMethod?: PaymentMode;

  /* ===================== PHONEPE DETAILS ===================== */

  /** Extracted UTR (UPI only) */
  @Prop()
  utr?: string;

  /** Card / NetBanking reference */
  @Prop()
  bankReferenceNumber?: string;


  @Prop()
  bankId?: string;

  /** Masked card or account */
  @Prop()
  maskedInstrument?: string;

  /** Authorization code (Cards) */
  @Prop()
  authorizationCode?: string;

  /* ===================== WEBHOOK DATA ===================== */

  /**
   * 🔥 FULL RAW PAYLOAD FROM PHONEPE
   * NEVER PARSE THIS DIRECTLY IN BUSINESS LOGIC
   */
  @Prop({ type: Object })
  rawPayload?: Record<string, any>;

  /**
   * Flattened gateway response (optional)
   */
  @Prop({ type: Object })
  gatewayResponse?: Record<string, any>;

  /* ===================== META ===================== */

  /** metaInfo.udf1 (your internal mapping) */
  @Prop()
  udf1?: string;

  @Prop()
  paidAt?: Date;

  @Prop()
  failureReason?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  /* ===================== IDEMPOTENCY ===================== */

  @Prop({ default: false })
  webhookProcessed: boolean;

  /* ===================== REFUND ===================== */

  @Prop({ default: false })
  isRefunded: boolean;

  @Prop()
  refundedAmount?: number;

  @Prop()
  refundedAt?: Date;

  @Prop()
  refundReason?: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

/* ===================== INDEXES ===================== */

PaymentSchema.index({ userId: 1, createdAt: -1 });
PaymentSchema.index({ merchantOrderId: 1 }, { unique: true });
PaymentSchema.index({ gatewayTransactionId: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ paymentMethod: 1 });
PaymentSchema.index({ paidAt: -1 });
