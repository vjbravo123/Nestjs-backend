import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Commission, CommissionDocument } from './commission.schema';
import { UpdateCommissionDto } from './dto/update-commission.dto';
import { flattenObject } from 'src/common/utils/flatten-object.util';

@Injectable()
export class CommissionService {
    constructor(
        @InjectModel(Commission.name) private commissionModel: Model<CommissionDocument>
    ) { }

    async createCommission(type: string, id: Types.ObjectId, dto: UpdateCommissionDto): Promise<CommissionDocument> {
        const query = type === 'event' 
            ? { eventId: id } 
            : { serviceId: id };

        const existingCommission = await this.commissionModel.findOne(query).exec();
        if (existingCommission) {
            throw new ConflictException(`Commission already exists for this ${type}`);
        }

        const commission = await this.commissionModel.create({
            ...dto,
            ...query 
        });

        return commission;
    }

    async getCommission(type: string, id: Types.ObjectId): Promise<CommissionDocument> {
        const query = type === 'event'
            ? { eventId: id }
            : { serviceId: id };

        const commission = await this.commissionModel.findOne(query).exec();

        if (!commission) {
            throw new NotFoundException(`Commission configuration not found for this ${type}`);
        }
        
        return commission;
    }

    async updateConfig(type: string, id: Types.ObjectId, updateCommissionDto: UpdateCommissionDto): Promise<CommissionDocument> {
        const commission = await this.getCommission(type, id);
        
        // 1. Flatten the incoming DTO into dot-notation paths using the external utility
        const flattenedData = flattenObject(updateCommissionDto);
        
        // 2. Safely apply updates to exact paths
        for (const key in flattenedData) {
            commission.set(key, flattenedData[key]);
        }
        
        return commission.save();
    }
}