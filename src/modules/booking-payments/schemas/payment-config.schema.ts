import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PaymentConfigDocument = HydratedDocument<PaymentConfig>;

/* -------------------- PARTIAL TIER -------------------- */

@Schema()
class PartialTier {
  @Prop({ required: true })
  days: number;

  @Prop({ required: true })
  percent: number;
}

const PartialTierSchema = SchemaFactory.createForClass(PartialTier);

/* -------------------- MAIN SCHEMA -------------------- */

@Schema({ timestamps: true })
export class PaymentConfig {

  /* ---------------- ONLINE DISCOUNT ---------------- */

  @Prop({
    type: { enabled: Boolean, amount: Number },
    default: { enabled: true, amount: 0 },
  })
  onlineDiscount: {
    enabled: boolean;
    amount: number;
  };

  /* ---------------- FULL BONUS ---------------- */

  @Prop({
    type: { enabled: Boolean, percent: Number },
    default: { enabled: true, percent: 0 },
  })
  fullBonus: {
    enabled: boolean;
    percent: number;
  };

  /* ---------------- OFFLINE SETTINGS ---------------- */

  @Prop({
    type: { enabled: Boolean, disableDays: Number },
    default: { enabled: true, disableDays: 0 },
  })
  offline: {
    enabled: boolean;
    disableDays: number;
  };

  /* ---------------- PARTIAL PAY (UPDATED STRUCTURE) ---------------- */

  @Prop({
    type: {
      enabled: Boolean,
      tiers: [PartialTierSchema],
    },
    default: {
      enabled: true,
      tiers: [],
    },
  })
  partialPay: {
    enabled: boolean;
    tiers: {
      days: number;
      percent: number;
    }[];
  };

  /* ---------------- CUSTOM SPLIT ---------------- */

  @Prop({
    type: { enabled: Boolean, availabilityDays: Number },
    default: { enabled: true, availabilityDays: 0 },
  })
  customSplit: {
    enabled: boolean;
    availabilityDays: number;
  };
}

export const PaymentConfigSchema =
  SchemaFactory.createForClass(PaymentConfig);
