import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import * as mongoose from 'mongoose';
import { mongooseGlobalTransformPlugin } from 'src/common/utils/mongoose-global-transform.plugin';
import { paginate } from 'src/common/utils/paginate.plugin';

@Schema({ _id: false })
export class FeeConfig {
  @Prop({ required: true, enum: ['percentage', 'flat'] })
  type: 'percentage' | 'flat';

  @Prop({ required: true, min: 0 })
  userCharge: number;

  @Prop({ required: true, min: 0 })
  vendorCharge: number;


  @Prop({ default: false })
  includeGST?: boolean;
}

@Schema({ _id: false })
export class GstConfig {
  @Prop({ required: true, min: 0, max: 100 })
  userCharge: number;

  @Prop({ required: true, min: 0, max: 100 })
  vendorCharge: number;
}

@Schema({ _id: false })
export class AdditionalCharge {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({
    required: true,
    enum: ['flat', 'percentage', 'expense'],
  })
  chargeType: string;
}

@Schema({ _id: false })
export class PricingSummary {
  @Prop({ default: 0 })
  userPayment: number;

  @Prop({ default: 0 })
  vendorPayout: number;

  @Prop({ default: 0 })
  adminProfit: number;
}

@Schema({ _id: false })
export class TierConfig {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  })
  tierId: Types.ObjectId;

  @Prop({ required: true })
  tierName: string;

  @Prop({ required: true, min: 0 })
  basePrice: number;

  @Prop({ type: FeeConfig, required: true })
  platformFee: FeeConfig;

  @Prop({ type: FeeConfig, required: true })
  zappyCommission: FeeConfig;

  @Prop({ type: FeeConfig, required: true })
  gatewayFee: FeeConfig;

  @Prop({ type: GstConfig, required: true })
  gst: GstConfig;

  @Prop({ type: [AdditionalCharge], default: [] })
  additionalCharges?: AdditionalCharge[];

  @Prop({ type: PricingSummary, default: () => ({}) })
  pricing: PricingSummary;
}

export type CommissionDocument = HydratedDocument<Commission>;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class Commission {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
  })
  eventId?: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'addons',
  })
  serviceId?: Types.ObjectId;
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
  })
  vendorId?: Types.ObjectId;

  @Prop({ type: [TierConfig], default: [] })
  tiers: TierConfig[];
}

export const CommissionSchema = SchemaFactory.createForClass(Commission);
CommissionSchema.plugin(paginate)
CommissionSchema.plugin(mongooseGlobalTransformPlugin)

/**
 * Unique Commission per Event
 */
CommissionSchema.index(
  { eventId: 1 },
  { unique: true, partialFilterExpression: { eventId: { $exists: true } } },
);

/**
 * Unique Commission per Service
 */
CommissionSchema.index(
  { serviceId: 1 },
  { unique: true, partialFilterExpression: { serviceId: { $exists: true } } },
);

/**
 * Validation safety
 */
CommissionSchema.pre('validate', function (next) {
  if (!this.eventId && !this.serviceId) {
    next(new Error('Either eventId or serviceId is required'));
  }
  next();
});