import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaymentConfig, PaymentConfigDocument } from './schemas/payment-config.schema';
import { UpdatePaymentConfigDto } from './dto/update-payment-config.dto';

@Injectable()
export class PaymentConfigService {
  constructor(
    @InjectModel(PaymentConfig.name) private configModel: Model<PaymentConfigDocument>,
  ) {}

  // Get the configuration. If it doesn't exist, return a default structure.
  async getConfig() {
    const config = await this.configModel.findOne().exec();
    if (!config) {
      // Return defaults if DB is empty
      return {
        partialPayment: { enabled: true, bookingPercent: 10, daysThreshold: 7 },
        customSplit: { enabled: true, min: 10, max: 90, daysThreshold: 3 },
        offlineMode: { enabled: true, instructions: "" },
        finalPaymentDueDays: 2,
        autoCancelUnpaidDays: 1,
        coupons: []
      };
    }
    return config;
  }

  // Update or Create the configuration
  async updateConfig(dto: UpdatePaymentConfigDto) {
    // We maintain only ONE document for settings.
    // We find the first one and update it, or create it if missing.
    const config = await this.configModel.findOneAndUpdate(
      {}, // find criteria (empty means match any)
      { $set: dto }, // update
      { new: true, upsert: true, setDefaultsOnInsert: true } // options
    ).exec();
    
    return config;
  }

  // Helper to validate a coupon code (can be used during Booking Checkout)
  async validateCoupon(code: string) {
    const config = await this.configModel.findOne({ 'coupons.code': code }).exec();
    if (!config) return null;
    
    const coupon = config.coupons.find(c => c.code === code);
    return coupon;
  }
}