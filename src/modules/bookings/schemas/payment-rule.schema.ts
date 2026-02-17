import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PaymentRuleDocument = HydratedDocument<PaymentRule>;

@Schema({ collection: 'payment_rules' })
export class PaymentRule {
  @Prop({ required: true, unique: true })
  ruleId: string; // 'super-early', 'standard'

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  rangeStart: number;

  @Prop()
  rangeEnd: number; // Nullable

  @Prop({ default: 0 })
  minFlatDeposit: number;

  @Prop()
  color: string; // Tailwind string

  // Storing the milestone template structure as a flexible array
  @Prop({ type: Array, default: [] })
  milestones: Record<string, any>[]; 
}

export const PaymentRuleSchema = SchemaFactory.createForClass(PaymentRule);