import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaymentHistory, PaymentHistoryDocument } from './payment-history.schema';
import { CreateHistoryDto } from './dto/create-history.dto';
import { UpdateHistoryStatusDto } from './dto/update-status.dto';


interface MilestoneRule {
    daysBefore: number;
    targetPercent: number;
    name: string;
}

interface MilestoneEntry {
    name: string;
    amount: number;
    dueDate: Date;
    targetPercentage: number;
    status: 'pending' | 'paid' | 'failed' | 'pay_at_venue';
    paidAt?: Date;
    transactionId?: string;
}

@Injectable()
export class PaymentHistoryService {
    constructor(
        @InjectModel(PaymentHistory.name)
        private readonly historyModel: Model<PaymentHistoryDocument>,
    ) { }

    async createSchedule(userId: string, dto: CreateHistoryDto) {
        const existing = await this.historyModel.findOne({ orderId: dto.orderId });
        if (existing) throw new BadRequestException('Payment schedule already exists for this order');

        // Generate the schedule 
        const schedule = this.generateMilestones(
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

    
    private generateMilestones(
        totalAmount: number,
        initialPaid: number,
        eventDate: Date,
        initialTxnId: string
    ): MilestoneEntry[] {

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


        let milestonesRules: MilestoneRule[] = [];

        // 2. Define Rules based on Lead Time
        if (diffDays > 60) {
            milestonesRules = [
                { daysBefore: 30, targetPercent: 0.50, name: 'First Installment (50%)' },
                { daysBefore: 7, targetPercent: 1.00, name: 'Final Balance' }

                // { daysBefore: 45, targetPercent: 0.30, name: 'First Installment (30%)' },
                // { daysBefore: 20, targetPercent: 0.60, name: 'Second Installment (60%)' },
                // { daysBefore: 7, targetPercent: 1.00, name: 'Final Balance (100%)' }

            ];
        } else if (diffDays >= 31) {
            milestonesRules = [
                { daysBefore: 15, targetPercent: 0.50, name: 'First Installment (50%)' },
                { daysBefore: 7, targetPercent: 1.00, name: 'Final Balance' }
            ];
        } else if (diffDays >= 15) {
            milestonesRules = [
                { daysBefore: 5, targetPercent: 1.00, name: 'Full Payment' }
            ];
        } else if (diffDays >= 8) {
            milestonesRules = [
                { daysBefore: 3, targetPercent: 1.00, name: 'Full Payment' }
            ];
        } else {
            // Last Minute (0-7 days)
            milestonesRules = [
                { daysBefore: 0, targetPercent: 1.00, name: 'Remaining Balance' }
            ];
        }

        // 3. Calculate Amounts
        milestonesRules.forEach(rule => {
            const targetAmount = totalAmount * rule.targetPercent;

            // Core Logic: Due = Max(0, Target - PaidSoFar)
            const dueAmount = targetAmount - cumulativePaid;

            // Calculate Due Date
            const dueDate = new Date(eventDate);
            dueDate.setDate(eventDate.getDate() - rule.daysBefore);

            if (dueAmount > 0) {
                schedule.push({
                    name: rule.name,
                    amount: Math.round(dueAmount),
                    dueDate: dueDate,
                    targetPercentage: rule.targetPercent,
                    status: 'pending'
                });

                // Important: Update cumulative paid to include this newly created installment
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