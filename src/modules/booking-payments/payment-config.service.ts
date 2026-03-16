import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PaymentConfig,
  PaymentConfigDocument,
} from './schemas/payment-config.schema';
import { UpdatePaymentConfigDto } from './dto/update-payment-config.dto';

@Injectable()
export class PaymentConfigService {
  constructor(
    @InjectModel(PaymentConfig.name)
    private readonly configModel: Model<PaymentConfigDocument>,
  ) { }

  /* --------------------------------------------
     GET CONFIG
  -------------------------------------------- */
  async getConfig(): Promise<PaymentConfigDocument> {
    try {
      console.log('➡️ Inside PaymentConfigService.getConfig()');

      let config = await this.configModel.findOne().exec();

      if (!config) {
        config = await this.configModel.create({});
      }

      return config;
    } catch (error) {
      console.error('❌ Error inside getConfig():', error);
      throw error;
    }
  }

  /* --------------------------------------------
     UPDATE CONFIG
  -------------------------------------------- */
  async updateConfig(
    dto: UpdatePaymentConfigDto,
  ): Promise<PaymentConfigDocument> {

    // Sort tiers descending (same logic, new location)
    if (dto.partialPay?.tiers?.length) {
      dto.partialPay.tiers.sort((a, b) => b.days - a.days);
    }

    let config = await this.configModel.findOneAndUpdate(
      {},
      { $set: dto },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    ).exec();

    if (!config) {
      config = await this.configModel.create(dto);
    }

    return config;
  }

  /* --------------------------------------------
     GET PARTIAL PERCENT BY DAYS
  -------------------------------------------- */
  async getPartialPercentByDays(daysRemaining: number): Promise<number> {
    const config = await this.configModel.findOne().exec();
    if (!config || !config.partialPay?.tiers?.length) return 0;

    const tier = config.partialPay.tiers.find(
      (t) => daysRemaining >= t.days,
    );

    return tier ? tier.percent : 0;
  }

  /* --------------------------------------------
     APPLY ONLINE DISCOUNT
  -------------------------------------------- */
  async applyOnlineDiscount(totalAmount: number): Promise<number> {
    const config = await this.configModel.findOne().exec();
    if (!config?.onlineDiscount?.enabled) return 0;

    return config.onlineDiscount.amount || 0;
  }

  /* --------------------------------------------
     APPLY FULL BONUS
  -------------------------------------------- */
  async applyFullBonus(totalAmount: number): Promise<number> {
    const config = await this.configModel.findOne().exec();
    if (!config?.fullBonus?.enabled) return 0;

    const percent = config.fullBonus.percent || 0;
    return (totalAmount * percent) / 100;
  }

  /* --------------------------------------------
     OFFLINE DISABLED CHECK
  -------------------------------------------- */
  async isOfflineDisabled(daysBeforeEvent: number): Promise<boolean> {
    const config = await this.configModel.findOne().exec();
    if (!config?.offline?.enabled) return false;

    return daysBeforeEvent <= config.offline.disableDays;
  }
}
