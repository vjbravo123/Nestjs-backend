import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentRulesController } from './payment-rules.controller';
import { PaymentRulesService } from './payment-rules.service';
import { PaymentRule, PaymentRuleSchema } from './payment-rules.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PaymentRule.name, schema: PaymentRuleSchema }
    ])
  ],
  controllers: [PaymentRulesController],
  providers: [PaymentRulesService],
  exports: [PaymentRulesService] 
})
export class PaymentRulesModule {}