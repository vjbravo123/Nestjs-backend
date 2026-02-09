import { Module } from '@nestjs/common';
import { DraftCartController } from './draft-cart.controller';
import { DraftCartService } from './draft-cart.service';
import { MongooseModule } from '@nestjs/mongoose';
import { DraftCartItem, DraftCartItemSchema } from './draft-cart.schema';


import { AddOn, AddOnSchema } from '../../addOn/addon.schema';
import { BirthdayEvent, BirthdayEventSchema } from '../../birthdayevent/birthdayevent.schema';
import { ExperientialEvent, ExperientialEventSchema } from '../../experientialevent/experientialevent.schema';
import { AddOnModule } from '../../addOn/addon.module'
import { Order, OrderSchema } from '../../order/order.schema';
import { Coupon, CouponSchema } from '../../coupon/coupon.schema';
@Module({
    imports: [
        MongooseModule.forFeature([
            { name: DraftCartItem.name, schema: DraftCartItemSchema },
            { name: AddOn.name, schema: AddOnSchema },
            { name: BirthdayEvent.name, schema: BirthdayEventSchema },
            { name: ExperientialEvent.name, schema: ExperientialEventSchema },
            { name: Order.name, schema: OrderSchema },
            { name: Coupon.name, schema: CouponSchema },
        ]),
        AddOnModule,
    ],
    controllers: [DraftCartController],
    providers: [DraftCartService],

    // 🔥 THIS WAS MISSING
    exports: [
        MongooseModule, // ⚠ exports all registered models from this module
        DraftCartService,
        
    ],
})
export class DraftCartModule { }
