import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BirthdayEvent, BirthdayEventSchema } from './birthdayevent.schema';
import { AddOn, AddOnSchema } from '../addOn/addon.schema';
import { Order, OrderSchema } from '../order/order.schema';
import { BirthdayEventController } from './birthdayevent.controller';
import { BirthdayEventService } from './birthdayevent.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BirthdayEvent.name, schema: BirthdayEventSchema },
      { name: AddOn.name, schema: AddOnSchema },
      { name: Order.name, schema: OrderSchema }
    ])
  ],
  controllers: [BirthdayEventController],
  providers: [BirthdayEventService],
  exports: [BirthdayEventService],  // ✔ ONLY export services
})
export class BirthdayEventModule { }
