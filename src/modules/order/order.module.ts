import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './order.schema';
import { Cart, CartSchema } from '../cart/cart.schema';
import { Coupon, CouponSchema } from '../coupon/coupon.schema';
import { CartItemModule } from '../carts/cart.module'
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { CountersModule } from '../counters/counters.module';
import { OrderNumberService } from './services/order-number.service';
import { CheckoutModule } from '../checkout/checkout.module';
import { CheckoutIntent, CheckoutIntentSchema } from '../checkout/checkout-intent.schema';
import { User, UserSchema } from '../users/users.schema';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Cart.name, schema: CartSchema },
      { name: Coupon.name, schema: CouponSchema },
      { name: CheckoutIntent.name, schema: CheckoutIntentSchema },
      { name: User.name, schema: UserSchema },
    ]),
    CartItemModule,
    CountersModule,
    CheckoutModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, OrderNumberService],

  exports: [
    OrderService,
    MongooseModule, // ✅ export MongooseModule so other modules (AuthModule, etc.) can inject VendorModel
  ],
})
export class OrderModule { }
