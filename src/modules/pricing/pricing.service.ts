import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Pricing, PricingDocument } from './pricing.schema';
import { UpdatePricingDto } from './dto/update-pricing.dto';

@Injectable()
export class PricingService {
  constructor(
    @InjectModel(Pricing.name) private pricingModel: Model<PricingDocument>
  ) {}

  // Get config by Service ID. Auto-create if it doesn't exist.
  async getPricing(serviceId: string): Promise<PricingDocument> {
    let pricing = await this.pricingModel.findOne({ serviceId: new Types.ObjectId(serviceId) }).exec();
    
    if (!pricing) {
      pricing = await this.pricingModel.create({
        serviceId: new Types.ObjectId(serviceId),
        config: {
          basePrice: 0,
          commissionRate: 15,
          pgRate: 2.5,
          gstRate: 18.0,
          pgGstEnabled: true,
          commGstEnabled: true,
          customFees: []
        }
      });
    }
    return pricing;
  }

  // Update Config for specific Service ID
  async updateConfig(serviceId: string, updatePricingDto: UpdatePricingDto) {
    const pricing = await this.getPricing(serviceId);
    
    if (updatePricingDto.config) {
      pricing.config = { 
        ...pricing.config, 
        ...updatePricingDto.config 
      };
    }
    return pricing.save();
  }
}