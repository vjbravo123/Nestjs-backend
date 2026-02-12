import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

    async createSchedule(userId: string, dto: CreateHistoryDto) {
        // Idempotency check
        const existing = await this.historyModel.findOne({ orderId: dto.orderId });
        if (existing) return existing;

         
        const validatedSchedule = dto.schedule.map(milestone => {
            // Mandatory Transaction ID
            if (milestone.status === 'paid') {
                if (!milestone.transactionId) {
                    throw new BadRequestException(
                        `Milestone '${milestone.name}' is marked as PAID but missing a transactionId.`
                    );
                }
                
                return { ...milestone, paidAt: new Date() };
            }
            return milestone;
        });

        return this.historyModel.create({
            userId: new Types.ObjectId(userId),
            orderId: dto.orderId,
            totalEventCost: dto.totalAmount,
            paymentPlan: dto.paymentPlan,
            schedule: validatedSchedule 
        });
    }

    async updateMilestoneStatus(dto: UpdateHistoryStatusDto) {
        const history = await this.historyModel.findOne({ orderId: dto.orderId });
        
        if (!history) {
            throw new NotFoundException('Payment history not found');
        }

        const milestone = history.schedule.find(m => m.name === dto.milestoneName);
        
        if (!milestone) {
            throw new NotFoundException(`Milestone '${dto.milestoneName}' not found`);
        }

        milestone.status = dto.status;
        
        if (dto.status === 'paid') {
            milestone.paidAt = new Date(); 
        }
        
        if (dto.transactionId) {
            milestone.transactionId = dto.transactionId;
        }

        // Mongoose nested array updates
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