import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { Pricing, PricingSchema } from './pricing.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Pricing.name, schema: PricingSchema }]),
  ],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService], 
})
export class PricingModule {}