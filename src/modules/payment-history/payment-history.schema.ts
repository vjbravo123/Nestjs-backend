import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentHistoryDocument = PaymentHistory & Document;

@Schema({ _id: false })
class Milestone {
    @Prop({ required: true })
    name: string; 

    @Prop({ required: true })
    amount: number;

    @Prop({ 
        enum: ['pending', 'paid', 'failed', 'pay_at_venue'], 
        default: 'pending' 
    })
    status: string;

    @Prop()
    paidAt?: Date; 

    @Prop()
    transactionId?: string;
}

const MilestoneSchema = SchemaFactory.createForClass(Milestone);

@Schema({ timestamps: true })
export class PaymentHistory {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Prop({ required: true, unique: true })
    orderId: string; 

    @Prop({ required: true })
    totalEventCost: number;

    @Prop({ required: true })
    paymentPlan: string; 

    @Prop({ type: [MilestoneSchema], default: [] })
    schedule: Milestone[];
}

export const PaymentHistorySchema = SchemaFactory.createForClass(PaymentHistory);