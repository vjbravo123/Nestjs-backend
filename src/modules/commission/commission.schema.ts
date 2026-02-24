import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class FeeConfig {
  @Prop({ required: true, enum: ['percentage', 'flat'] }) type: string;
  @Prop({ required: true }) userCharge: number;
  @Prop({ required: true }) vendorCharge: number;
  @Prop({ default: 0 }) userAmount: number;
  @Prop({ default: 0 }) vendorAmount: number;
  @Prop({ required: true }) includeGST: boolean; 
}

@Schema({ _id: false })
export class GstConfig {
  @Prop({ required: true }) userCharge: number;
  @Prop({ required: true }) vendorCharge: number;
  @Prop({ default: 0 }) userAmount: number;
  @Prop({ default: 0 }) vendorAmount: number;
}

@Schema({ _id: false })
export class AdditionalCharge {
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) amount: number;
  @Prop({ required: true }) chargeType: string;
}

@Schema({ _id: false })
export class PricingSummary {
  @Prop({ default: 0 }) userPayment: number;
  @Prop({ default: 0 }) vendorPayout: number;
  @Prop({ default: 0 }) adminProfit: number;
}

@Schema({ _id: false })
export class GstToggles {
  @Prop({ required: true }) applyGstOnPlatformFee: boolean;
  @Prop({ required: true }) applyGstOnGatewayFee: boolean;
  @Prop({ required: true }) applyGstOnZappyCommission: boolean;
  @Prop({ required: true }) applyGstOnAdditionalCharges: boolean;
}

export type CommissionDocument = Commission & Document;

@Schema({ timestamps: true })
export class Commission {
  @Prop({ type: Types.ObjectId, ref: 'Event', sparse: true })
  eventId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Service', sparse: true })
  serviceId?: Types.ObjectId;

  @Prop({ required: true }) 
  basePrice: number;

  @Prop({ type: FeeConfig, required: true }) 
  platformFee: FeeConfig;

  @Prop({ type: GstConfig, required: true }) 
  gst: GstConfig;

  @Prop({ type: FeeConfig, required: true }) 
  gatewayFee: FeeConfig;

  @Prop({ type: FeeConfig, required: true }) 
  zappyCommission: FeeConfig;

  @Prop({ type: [AdditionalCharge], default: [] })
  additionalCharges: AdditionalCharge[];

  @Prop({ default: 0 })
  totalAdditionalCharges: number;

  @Prop({ required: true }) 
  includeGST: boolean;

  @Prop({ type: PricingSummary, default: () => ({}) })
  pricing: PricingSummary;

  @Prop({ type: GstToggles, required: true }) 
  gstToggles: GstToggles;
}

export const CommissionSchema = SchemaFactory.createForClass(Commission);

CommissionSchema.index({ eventId: 1 }, { sparse: true });
CommissionSchema.index({ serviceId: 1 }, { sparse: true });