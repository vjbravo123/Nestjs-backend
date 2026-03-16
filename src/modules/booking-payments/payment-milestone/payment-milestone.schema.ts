import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PaymentMilestoneDocument = HydratedDocument<PaymentMilestone>;

/* -------------------- MILESTONE ITEM -------------------- */

@Schema()
class MilestoneItem {
  @Prop({ required: true })
  daysRemaining: number;

  @Prop({ required: true })
  percentage: number;
}

const MilestoneItemSchema = SchemaFactory.createForClass(MilestoneItem);

/* -------------------- MAIN SCHEMA -------------------- */

@Schema({ timestamps: true })
export class PaymentMilestone {
  @Prop({
    type: [MilestoneItemSchema],
    default: [],
  })
  milestonesData: {
    daysRemaining: number;
    percentage: number;
  }[];

  @Prop({ required: true, default: 0 })
  totalPercentage: number;
}

export const PaymentMilestoneSchema =
  SchemaFactory.createForClass(PaymentMilestone);

PaymentMilestoneSchema.pre('save', function (next) {
  const totalPercentage = this.milestonesData.reduce(
    (sum, item) => sum + item.percentage,
    0,
  );
  this.totalPercentage = totalPercentage;

  if (totalPercentage !== 100) {
    return next(
      new Error(
        `Total percentage must equal 100%, but got ${totalPercentage}%`,
      ),
    );
  }

  next();
});
