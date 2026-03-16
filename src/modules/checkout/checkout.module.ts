import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

import {
    CheckoutIntent,
    CheckoutIntentSchema,
} from './checkout-intent.schema';

import { CartItem, CartItemSchema } from '../carts/cart.schema';
import { Order, OrderSchema } from '../order/order.schema';
import { Coupon, CouponSchema } from '../coupon/coupon.schema';
import { User, UserSchema } from '../users/users.schema';
import { DraftCartModule } from '../carts/draft-cart/draft-cart.module';
import { BirthdayEvent, BirthdayEventSchema } from '../birthdayevent/birthdayevent.schema';
import { ExperientialEvent, ExperientialEventSchema } from '../experientialevent/experientialevent.schema';
import { AddOn, AddOnSchema } from '../addOn/addon.schema';

/* --------------------------------------------------
 * 📦 Schema registrations for Checkout domain
 * -------------------------------------------------- */
const checkoutSchemas = [
    { name: CheckoutIntent.name, schema: CheckoutIntentSchema },
    { name: CartItem.name, schema: CartItemSchema },
    { name: Order.name, schema: OrderSchema },
    { name: Coupon.name, schema: CouponSchema },
    { name: User.name, schema: UserSchema },
    { name: BirthdayEvent.name, schema: BirthdayEventSchema },
    { name: ExperientialEvent.name, schema: ExperientialEventSchema },
    { name: AddOn.name, schema: AddOnSchema },
];

@Module({
    imports: [
        MongooseModule.forFeature(checkoutSchemas),
        DraftCartModule
    ],
    controllers: [CheckoutController],
    providers: [CheckoutService],
    exports: [
        CheckoutService, // ✅ only export service
    ],
})
export class CheckoutModule { }
