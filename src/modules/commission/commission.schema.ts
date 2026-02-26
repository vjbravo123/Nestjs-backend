import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import * as mongoose from 'mongoose';

@Schema({ _id: false })
export class FeeConfig {
  @Prop({ required: true, enum: ['percentage', 'flat'] }) type: string;
  @Prop({ required: true }) userCharge: number;
  @Prop({ required: true }) vendorCharge: number;
}

@Schema({ _id: false })
export class GatewayFeeConfig {
  @Prop({ required: true, enum: ['percentage', 'flat'] }) type: string;
  @Prop({ required: true }) userCharge: number;
  @Prop({ required: true }) vendorCharge: number;
  @Prop({ required: true, default: false }) includeGST: boolean; 
}

@Schema({ _id: false })
export class GstConfig {
  @Prop({ required: true }) userCharge: number;
  @Prop({ required: true }) vendorCharge: number;
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
export class TierConfig {
  @Prop({ required: true }) tierId: string;
  @Prop({ required: true, default: 'Unknown Tier' }) tierName: string;
  @Prop({ required: true }) basePrice: number;
  
  @Prop({ type: FeeConfig, required: true }) platformFee: FeeConfig;
  @Prop({ type: GstConfig, required: true }) gst: GstConfig;
  
  @Prop({ type: GatewayFeeConfig, required: true }) gatewayFee: GatewayFeeConfig;
  
  @Prop({ type: FeeConfig, required: true }) zappyCommission: FeeConfig;
  
  @Prop({ type: [AdditionalCharge], default:[] }) additionalCharges: AdditionalCharge[];
  @Prop({ default: 0 }) totalAdditionalCharges: number;
  @Prop({ type: PricingSummary, default: () => ({}) }) pricing: PricingSummary;
}

export type CommissionDocument = Commission & Document;

@Schema({ 
  timestamps: true,
  toJSON: {
    transform: (doc, ret: any) => {
      delete ret._id;
      delete ret.__v;
      delete ret.createdAt;
      delete ret.updatedAt;
      return ret;
    }
  },
  toObject: {
    transform: (doc, ret: any) => {
      delete ret._id;
      delete ret.__v;
      delete ret.createdAt;
      delete ret.updatedAt;
      return ret;
    }
  }
})
export class Commission {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Event', sparse: true })
  eventId?: Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Service', sparse: true })
  serviceId?: Types.ObjectId;

  @Prop({ type: [TierConfig], default:[] })
  tiers: TierConfig[];
}

export const CommissionSchema = SchemaFactory.createForClass(Commission);

CommissionSchema.index({ eventId: 1 }, { sparse: true });
CommissionSchema.index({ serviceId: 1 }, { sparse: true });