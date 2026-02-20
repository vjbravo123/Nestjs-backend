import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Pricing, PricingDocument } from './pricing.schema';
import { UpdatePricingDto } from './dto/update-pricing.dto';
import { CreateAddOnDto } from './dto/create-addon.dto';

@Injectable()
export class PricingService {
  constructor(
    @InjectModel(Pricing.name) private pricingModel: Model<PricingDocument>){}

  async getPricing(): Promise<PricingDocument> {
    let pricing = await this.pricingModel.findOne().exec();
    
    if (!pricing) {
      pricing = await this.pricingModel.create({
        config: {
          basePrice: 8500,
          commissionRate: 15,
          pgRate: 2.5,
          gstRate: 18.0,
          tdsRate: 1.0,
          pgGstEnabled: true,
          commGstEnabled: true,
        },
        addOns: [
          { name: 'Brand Kit / Marketing', description: 'Social media assets', type: 'fixed', value: 500, active: false, applyGst: true },
          { name: 'Training Fee', description: 'Onboarding session', type: 'fixed', value: 1000, active: false, applyGst: true },
          { name: 'Equipment Rental', description: 'Camera & Lights', type: 'fixed', value: 750, active: false, applyGst: true },
          { name: 'Photography Kit', description: 'Lens pack', type: 'fixed', value: 2000, active: false, applyGst: true },
        ]
      });
    }
    return pricing;
  }

  

  // Update Config (Base price, rates, etc)
  async updateConfig(updatePricingDto: UpdatePricingDto) {
    const pricing = await this.getPricing();
    if (updatePricingDto.config) {
      pricing.config = { 
        ...pricing.config, 
        ...updatePricingDto.config 
      };
    }
    return pricing.save();
  }



  // Add a new custom add-on
  async addAddOn(createAddOnDto: CreateAddOnDto) {
    const pricing = await this.getPricing();
    pricing.addOns.push(createAddOnDto as any);
    return pricing.save();
  }



  // Toggle an Add-on status
  async toggleAddOn(addOnId: string) {
    const pricing = await this.getPricing();
    
    // Find the addon by ID
    const addon = pricing.addOns.find((a: any) => 
      (a._id && a._id.toString() === addOnId) || (a.id === addOnId)
    );

    if (addon) {
      addon.active = !addon.active;
      pricing.markModified('addOns');
      return pricing.save();
    }
    
    return pricing;
  }
}