import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CartItem, CartItemSchema } from './cart.schema';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';

import { AddOn, AddOnSchema } from '../addOn/addon.schema';
import { BirthdayEvent, BirthdayEventSchema } from '../birthdayevent/birthdayevent.schema';
import { ExperientialEvent, ExperientialEventSchema } from '../experientialevent/experientialevent.schema';
import { AddOnModule } from '../addOn/addon.module'
import { DraftCartModule } from './draft-cart/draft-cart.module'
import { Order, OrderSchema } from '../order/order.schema';
import { Coupon, CouponSchema } from '../coupon/coupon.schema';

@Module({
    imports: [
        MongooseModule.forFeature([

            { name: CartItem.name, schema: CartItemSchema },
            { name: AddOn.name, schema: AddOnSchema },
            { name: BirthdayEvent.name, schema: BirthdayEventSchema },
            { name: ExperientialEvent.name, schema: ExperientialEventSchema },
            { name: Order.name, schema: OrderSchema },
            { name: Coupon.name, schema: CouponSchema },
        ]),
        AddOnModule,
        DraftCartModule
    ],
    controllers: [CartController],
    providers: [CartService],


    exports: [
        CartService,
        MongooseModule, // ✅ export MongooseModule so other modules (AuthModule, etc.) can inject VendorModel
    ],

})
export class CartItemModule { }
