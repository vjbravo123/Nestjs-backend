import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cart, CartSchema } from './cart.schema';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { AddOn, AddOnSchema } from '../addOn/addon.schema';
import { Order, OrderSchema } from '../order/order.schema';
import { BirthdayEvent, BirthdayEventSchema } from '../birthdayevent/birthdayevent.schema';
import { Coupon, CouponSchema } from '../coupon/coupon.schema';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cart.name, schema: CartSchema },
      { name: AddOn.name, schema: AddOnSchema },
      { name: BirthdayEvent.name, schema: BirthdayEventSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Coupon.name, schema: CouponSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule { }


