import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExperientialEvent, ExperientialEventSchema } from './experientialevent.schema';
import { AddOn, AddOnSchema } from '../addOn/addon.schema';
import { Order, OrderSchema } from '../order/order.schema';
import { ExperientialEventController } from './experientialevent.controller';
import { ExperientialEventService } from './experientialevent.service';
import { EventChangeHistoryModule } from '../event-change-history/event-change-history.module';
import { OrderModule } from '../order/order.module';
import { VendorAvailabilityModule } from '../vendoravailability/vendor-availability.module';

@Module({
  imports: [
    EventChangeHistoryModule,
    MongooseModule.forFeature([
      { name: ExperientialEvent.name, schema: ExperientialEventSchema },
      { name: AddOn.name, schema: AddOnSchema },
      { name: Order.name, schema: OrderSchema }
    ]),
    OrderModule,
    VendorAvailabilityModule,
  ],
  controllers: [ExperientialEventController],
  providers: [ExperientialEventService],   // ✔ ONLY services
  exports: [ExperientialEventService],     // ✔ Export service
})
export class ExperientialEventModule { }
