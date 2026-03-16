import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PaymentMilestone,
  PaymentMilestoneDocument,
} from './payment-milestone.schema';
import {
  CreatePaymentMilestoneDto,
  UpdatePaymentMilestoneDto,
} from '../dto/update-payment-milestone.dto';

@Injectable()
export class PaymentMilestoneService {
  constructor(
    @InjectModel(PaymentMilestone.name)
    private readonly milestoneModel: Model<PaymentMilestoneDocument>,
  ) { }

  /* --------------------------------------------
     GET ALL MILESTONE CONFIGS
  -------------------------------------------- */
  async getAll(): Promise<PaymentMilestoneDocument[]> {
    return this.milestoneModel.find().sort({ createdAt: -1 }).exec();
  }

  /* --------------------------------------------
     GET MILESTONE CONFIG BY ID
  -------------------------------------------- */
  async getById(id: string): Promise<PaymentMilestoneDocument> {
    const config = await this.milestoneModel.findById(id).exec();
    if (!config) {
      throw new NotFoundException(`Payment milestone with ID "${id}" not found.`);
    }
    return config;
  }

  /* --------------------------------------------
     CREATE MILESTONE CONFIG
  -------------------------------------------- */
  async create(
    dto: CreatePaymentMilestoneDto,
  ): Promise<PaymentMilestoneDocument> {
    this.validateTotalPercentage(dto.milestonesData, dto.totalPercentage);

    // Sort milestones descending by daysRemaining
    dto.milestonesData.sort((a, b) => b.daysRemaining - a.daysRemaining);

    return this.milestoneModel.findOneAndUpdate(
      {},
      { $set: dto },
      { new: true, upsert: true },
    ).exec();
  }

  /* --------------------------------------------
     UPDATE MILESTONE CONFIG BY ID
  -------------------------------------------- */
  async update(
    id: string,
    dto: UpdatePaymentMilestoneDto,
  ): Promise<PaymentMilestoneDocument> {
    const existing = await this.milestoneModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException(`Payment milestone with ID "${id}" not found.`);
    }

    // Validate totalPercentage against milestonesData
    const milestones = dto.milestonesData ?? existing.milestonesData;
    const total = dto.totalPercentage ?? existing.totalPercentage;
    this.validateTotalPercentage(milestones, total);

    // Sort milestones descending by daysRemaining
    if (dto.milestonesData?.length) {
      dto.milestonesData.sort((a, b) => b.daysRemaining - a.daysRemaining);
    }

    const updated = await this.milestoneModel.findByIdAndUpdate(
      id,
      { $set: dto },
      { new: true },
    ).exec();
    if (!updated) {
      throw new NotFoundException(`Payment milestone with ID "${id}" not found.`);
    }
    return updated;
  }

  /* --------------------------------------------
     DELETE MILESTONE CONFIG BY ID
  -------------------------------------------- */
  async delete(id: string): Promise<PaymentMilestoneDocument> {
    const deleted = await this.milestoneModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException(`Payment milestone with ID "${id}" not found.`);
    }
    return deleted;
  }

  /* --------------------------------------------
     VALIDATE TOTAL PERCENTAGE
  -------------------------------------------- */
  private validateTotalPercentage(
    milestonesData: { percentage: number }[],
    totalPercentage: number,
  ) {
    const sum = milestonesData.reduce((acc, m) => acc + m.percentage, 0);
    if (sum !== totalPercentage) {
      throw new BadRequestException(
        `Sum of milestone percentages (${sum}) does not match totalPercentage (${totalPercentage}).`,
      );
    }
  }
}
