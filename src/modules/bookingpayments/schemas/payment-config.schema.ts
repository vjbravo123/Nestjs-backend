import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PaymentConfigDocument = PaymentConfig & Document;

@Schema()
class Coupon {
  @Prop({ required: true })
  id: string; 

  @Prop({ required: true, uppercase: true })
  code: string;

  @Prop({ required: true, enum: ['percent', 'flat'] })
  type: string;

  @Prop({ required: true })
  value: number;

  @Prop({ default: 0 })
  usedCount: number;
}

@Schema({ timestamps: true })
export class PaymentConfig {
  // 1. Split Payment Rules
  @Prop({ 
    type: { 
      enabled: Boolean, 
      bookingPercent: Number, 
      daysThreshold: Number 
    }, 
    default: { enabled: true, bookingPercent: 10, daysThreshold: 7 } 
  })
  partialPayment: {
    enabled: boolean;
    bookingPercent: number;
    daysThreshold: number;
  };

  @Prop({ 
    type: { 
      enabled: Boolean, 
      min: Number, 
      max: Number, 
      daysThreshold: Number 
    },
    default: { enabled: true, min: 10, max: 90, daysThreshold: 3 }
  })
  customSplit: {
    enabled: boolean;
    min: number;
    max: number;
    daysThreshold: number;
  };

  // --- NEW: Online Payment Incentives ---
  @Prop({
    type: {
      enabled: Boolean,
      standardFlat: Number,
      fullPaymentPercent: Number,
      promoCode: {
        enabled: Boolean,
        code: String,
        amount: Number
      }
    },
    default: {
      enabled: true,
      standardFlat: 199,
      fullPaymentPercent: 5,
      promoCode: {
        enabled: true,
        code: "WEBDEAL",
        amount: 150
      }
    }
  })
  onlineDiscounts: {
    enabled: boolean;
    standardFlat: number;
    fullPaymentPercent: number;
    promoCode: {
      enabled: boolean;
      code: string;
      amount: number;
    };
  };

  // 2. Offline / Reserve
  @Prop({ 
    type: { enabled: Boolean, instructions: String },
    default: { enabled: true, instructions: "Pay at venue." }
  })
  offlineMode: {
    enabled: boolean;
    instructions: string;
  };

  // 3. Deadlines
  @Prop({ default: 2 })
  finalPaymentDueDays: number; 

  @Prop({ default: 1 })
  autoCancelUnpaidDays: number; 

  // 4. Coupons
  @Prop({ type: [SchemaFactory.createForClass(Coupon)], default: [] })
  coupons: Coupon[];
}

export const PaymentConfigSchema = SchemaFactory.createForClass(PaymentConfig);