import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Commission, CommissionSchema } from './commission.schema';
import { CommissionService } from './commission.service';
import { CommissionController } from './commission.controller';
import { CommissionPricingService } from './commission-pricing.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Commission.name, schema: CommissionSchema },
    ]),
  ],
  controllers: [CommissionController],
  providers: [CommissionService, CommissionPricingService],
  exports: [CommissionService],
})
export class CommissionModule {}