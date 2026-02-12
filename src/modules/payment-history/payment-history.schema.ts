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
    checkoutIntentId: string; // The Booking ID

    @Prop({ required: true })
    totalEventCost: number;

    @Prop({ required: true })
    paymentPlan: string; // 'full', 'partial', 'offline', 'custom'

    // MilestoneSchema Stores what is paid and what is pending
    @Prop({ type: [MilestoneSchema], default: [] })
    schedule: Milestone[];
    //order id , 
}

export const PaymentHistorySchema = SchemaFactory.createForClass(PaymentHistory);