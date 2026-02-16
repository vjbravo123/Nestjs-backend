import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaymentRule, PaymentRuleDocument } from './payment-rules.schema';
import { CreatePaymentRuleDto, UpdatePaymentRuleDto } from './dto/payment-rules.dto';

@Injectable()
export class PaymentRulesService {
    constructor(
        @InjectModel(PaymentRule.name) private ruleModel: Model<PaymentRuleDocument>
    ) {}

    async createRule(dto: CreatePaymentRuleDto) {
        return this.ruleModel.create(dto);
    }

    async findAll() {
        return this.ruleModel.find().sort({ minLeadTimeDays: 1 }).exec();
    }

    async updateRule(id: string, dto: UpdatePaymentRuleDto) {
        const updated = await this.ruleModel.findByIdAndUpdate(id, dto, { new: true });
        if (!updated) throw new NotFoundException('Rule not found');
        return updated;
    }

    async deleteRule(id: string) {
        return this.ruleModel.findByIdAndDelete(id);
    }

    
    async getRuleForLeadTime(diffDays: number): Promise<PaymentRuleDocument> {
        
        const rule = await this.ruleModel.findOne({
            minLeadTimeDays: { $lte: diffDays },
            maxLeadTimeDays: { $gte: diffDays }
        });

        if (!rule) {
            throw new BadRequestException(`No payment rule found for ${diffDays} days lead time.`);
        }

        return rule;
    }
}