import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PaymentRuleDocument = PaymentRule & Document;

@Schema({ _id: false })
export class MilestoneTemplate {
    @Prop({ required: true })
    name: string;

    @Prop({ required: true })
    daysBeforeEvent: number; 

    @Prop({ required: true })
    targetPercentage: number; 
}

@Schema({ timestamps: true })
export class PaymentRule {
    @Prop({ required: true, unique: true })
    ruleName: string; 

    @Prop({ required: true })
    minLeadTimeDays: number; 

    @Prop({ required: true })
    maxLeadTimeDays: number; 

    @Prop({ type: [SchemaFactory.createForClass(MilestoneTemplate)], default: [] })
    milestones: MilestoneTemplate[];
}

export const PaymentRuleSchema = SchemaFactory.createForClass(PaymentRule);