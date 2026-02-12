import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaymentHistory, PaymentHistoryDocument } from './payment-history.schema';
import { CreateHistoryDto } from './dto/create-history.dto';
import { UpdateHistoryStatusDto } from './dto/update-status.dto';

@Injectable()
export class PaymentHistoryService {
    constructor(
        @InjectModel(PaymentHistory.name)
        private readonly historyModel: Model<PaymentHistoryDocument>,
    ) {}

    //FOR POST: Create the Schedule
    async createSchedule(userId: string, dto: CreateHistoryDto) {
        // Idempotency: If schedule exists, return it
        const existing = await this.historyModel.findOne({ checkoutIntentId: dto.checkoutIntentId });
        if (existing) return existing;

        
        const milestones: any[] = [];
        
        const balance = dto.totalAmount - dto.amountToPayNow;

        if (dto.paymentPlan === 'offline') {
            milestones.push({
                name: 'Full Payment (At Venue)',
                amount: dto.totalAmount,
                status: 'pay_at_venue',
                paidAt: null
            });
        } 
        else if (balance <= 0) {
            // Full Payment Plan
            milestones.push({
                name: 'Full Payment',
                amount: dto.totalAmount,
                status: 'pending',
                paidAt: null
            });
        } 
        else {
            // Partial / Custom Plan
            // 1. Current Payment (Advance)
            milestones.push({
                name: 'Booking Advance',
                amount: dto.amountToPayNow,
                status: 'pending',
                paidAt: null
            });

            // 2. Future Pending Payment (Balance)
            milestones.push({
                name: 'Remaining Balance',
                amount: balance,
                status: 'pending',
                paidAt: null
            });
        }

        return this.historyModel.create({
            userId: new Types.ObjectId(userId),
            checkoutIntentId: dto.checkoutIntentId,
            totalEventCost: dto.totalAmount,
            paymentPlan: dto.paymentPlan,
            schedule: milestones
        });
    }

    // 🟡 PATCH: Update a specific Milestone to PAID
    async updateMilestoneStatus(dto: UpdateHistoryStatusDto) {
        console.log({ checkoutIntentId: dto.checkoutIntentId });
        
        const history = await this.historyModel.findOne({ checkoutIntentId: dto.checkoutIntentId });
        
        if (!history) {
            throw new NotFoundException('Payment history not found for this booking');
        }

        // Find the specific milestone
        const milestone = history.schedule.find(m => m.name === dto.milestoneName);
        
        if (!milestone) {
            throw new NotFoundException(`Milestone '${dto.milestoneName}' not found in schedule`);
        }

        milestone.status = dto.status;
        
        if (dto.status === 'paid') {
            milestone.paidAt = new Date(); 
        }
        
        if (dto.transactionId) {
            milestone.transactionId = dto.transactionId;
        }

        
        history.markModified('schedule');
        
        return history.save();
    }

    // GET: Fetch History by Booking ID
    async getHistory(checkoutIntentId: string) {
        const history = await this.historyModel.findOne({ checkoutIntentId });
        console.log(history);        
        if (!history) throw new NotFoundException('History not found');
        return history;
    }

    // 📜 GET: Fetch All History for a User
    async getUserHistory(userId: string) {
        return this.historyModel
            .find({ userId: new Types.ObjectId(userId) })
            .sort({ createdAt: -1 })
            .exec();
    }
}