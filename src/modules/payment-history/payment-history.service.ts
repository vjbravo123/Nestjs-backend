import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaymentHistory, PaymentHistoryDocument } from './payment-history.schema';
import { CreateHistoryDto } from './dto/create-history.dto';
import { UpdateHistoryStatusDto } from './dto/update-status.dto';
import { PaymentRulesService } from '../payment-rules/payment-rules.service';

interface MilestoneEntry {
    name: string;
    amount: number;
    dueDate: Date;
    targetPercentage: number;
    status: 'pending' | 'paid' | 'failed' | 'pay_at_venue' | 'skipped';
    paidAt?: Date;
    transactionId?: string;
}

@Injectable()
export class PaymentHistoryService {
    constructor(
        @InjectModel(PaymentHistory.name)
        private readonly historyModel: Model<PaymentHistoryDocument>,
        private readonly rulesService: PaymentRulesService
    ) { }

    async createSchedule(userId: string, dto: CreateHistoryDto) {
        const existing = await this.historyModel.findOne({ orderId: dto.orderId });
        if (existing) throw new BadRequestException('Payment schedule already exists for this order');

        const schedule = await this.generateMilestones(
            dto.totalAmount,
            dto.initialPaidAmount,
            new Date(dto.eventDate),
            dto.transactionId
        );

        return this.historyModel.create({
            userId: new Types.ObjectId(userId),
            orderId: dto.orderId,
            totalEventCost: dto.totalAmount,
            schedule: schedule
        });
    }

    
   private async generateMilestones(
        totalAmount: number,
        initialPaid: number,
        eventDate: Date,
        initialTxnId: string
    ): Promise<MilestoneEntry[]> {

        const today = new Date();
        const oneDay = 24 * 60 * 60 * 1000;
        const diffDays = Math.round(Math.abs((eventDate.getTime() - today.getTime()) / oneDay));

        const schedule: MilestoneEntry[] = [];
        let cumulativePaid = initialPaid;

        // 1. Add Initial Payment
        schedule.push({
            name: 'Booking Token / Advance',
            amount: initialPaid,
            dueDate: new Date(),
            targetPercentage: 0,
            status: 'paid',
            paidAt: new Date(),
            transactionId: initialTxnId
        });

        // 2. Fetch Dynamic Rules from Database
        const ruleInfo = await this.rulesService.getRuleForLeadTime(diffDays);

        // 3. Calculate Amounts
        // Create a copy and Sort Ascending (Smallest % -> Largest %)
        const sortedMilestones = [...ruleInfo.milestones].sort((a, b) => a.targetPercentage - b.targetPercentage);

        sortedMilestones.forEach(milestoneTemplate => {
            const targetAmount = totalAmount * milestoneTemplate.targetPercentage;

            // Core Logic: Due = Max(0, Target - PaidSoFar)
            const dueAmount = targetAmount - cumulativePaid;

            // Calculate Due Date
            const dueDate = new Date(eventDate);
            dueDate.setDate(eventDate.getDate() - milestoneTemplate.daysBeforeEvent);

            if (dueAmount > 0) {
                schedule.push({
                    name: milestoneTemplate.name,
                    amount: Math.round(dueAmount),
                    dueDate: dueDate,
                    targetPercentage: milestoneTemplate.targetPercentage,
                    status: 'pending'
                });

    
                cumulativePaid += dueAmount;
            }
        });

        return schedule;
    }

    async updateMilestoneStatus(dto: UpdateHistoryStatusDto) {
        const history = await this.historyModel.findOne({ orderId: dto.orderId });
        if (!history) throw new NotFoundException('History not found');

        const milestone = history.schedule.find(m => m.name === dto.milestoneName);
        if (!milestone) throw new NotFoundException('Milestone not found');

        if (dto.status === 'paid' || dto.status === 'failed') {
            milestone.status = dto.status;
        }

        if (dto.status === 'paid') {
            milestone.paidAt = new Date();
            if (dto.transactionId) milestone.transactionId = dto.transactionId;
        }

        history.markModified('schedule');
        return history.save();
    }

    async getHistoryByOrder(orderId: string) {
        const history = await this.historyModel.findOne({ orderId });
        if (!history) throw new NotFoundException('History not found');
        return history;
    }

    async getUserHistory(userId: string) {
        return this.historyModel
            .find({ userId: new Types.ObjectId(userId) })
            .sort({ createdAt: -1 })
            .exec();
    }
}