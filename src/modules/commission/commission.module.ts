import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommissionController } from './commission.controller';
import { CommissionService } from './commission.service';
import { Commission, CommissionSchema } from './commission.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Commission.name, schema: CommissionSchema }])
  ],
  controllers: [CommissionController],
  providers: [CommissionService],
  exports: [CommissionService],
})
export class CommissionModule {}