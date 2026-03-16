import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Order, OrderSchema } from './order.schema';
import { Cart, CartSchema } from '../cart/cart.schema';
import { Coupon, CouponSchema } from '../coupon/coupon.schema';
import { CartItemModule } from '../carts/cart.module';

import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderQueryService } from './services/order-query.service';
import { AdminOrderService } from './services/admin-order.service';
import { VendorOrderService } from './services/vendor-order.service';
import { OrderAvailabilityService } from './services/order-availability.service';

import { CountersModule } from '../counters/counters.module';
import { OrderNumberService } from './services/order-number.service';

import { CheckoutModule } from '../checkout/checkout.module';
import {
  CheckoutIntent,
  CheckoutIntentSchema,
} from '../checkout/checkout-intent.schema';

import { User, UserSchema } from '../users/users.schema';
import {
  ExperientialEvent,
  ExperientialEventSchema,
} from '../experientialevent/experientialevent.schema';
import {
  BirthdayEvent,
  BirthdayEventSchema,
} from '../birthdayevent/birthdayevent.schema';

import { AddOn, AddOnSchema } from '../addOn/addon.schema';
import { AddOnModule } from '../addOn/addon.module';

import {
  VendorAvailability,
  VendorAvailabilitySchema,
} from '../vendoravailability/vendor-availability.schema';
import { VendorAvailabilityModule } from '../vendoravailability/vendor-availability.module';

// ------------------------------------
// Vendor Booking
// ------------------------------------
import {
  VendorBooking,
  VendorBookingSchema,
} from './vendor-bookings/vendor-booking.schema';
import { VendorBookingService } from './vendor-bookings/vendor-booking.service';
import { VendorBookingController } from './vendor-bookings/vendor-booking.controller';
import { InstallmentModule } from '../installments/installment.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Cart.name, schema: CartSchema },
      { name: ExperientialEvent.name, schema: ExperientialEventSchema },
      { name: BirthdayEvent.name, schema: BirthdayEventSchema },
      { name: Coupon.name, schema: CouponSchema },
      { name: CheckoutIntent.name, schema: CheckoutIntentSchema },
      { name: User.name, schema: UserSchema },
      { name: AddOn.name, schema: AddOnSchema },
      { name: VendorAvailability.name, schema: VendorAvailabilitySchema },

      // ✅ Vendor Booking
      { name: VendorBooking.name, schema: VendorBookingSchema },
    ]),

    forwardRef(() => CartItemModule),
    CountersModule,
    VendorAvailabilityModule,
    InstallmentModule,
    VendorAvailabilityModule,
    CheckoutModule,
    forwardRef(() => AddOnModule),
  ],

  controllers: [
    OrderController,

    // ✅ Vendor booking endpoints
    VendorBookingController,
  ],

  providers: [
    OrderService,
    OrderQueryService,
    AdminOrderService,
    VendorOrderService,
    OrderAvailabilityService,
    OrderNumberService,

    // ✅ Vendor booking logic
    VendorBookingService,
  ],

  exports: [
    OrderService,
    OrderQueryService,
    AdminOrderService,
    VendorOrderService,
    OrderAvailabilityService,
    VendorBookingService,

    // allow other modules to reuse schemas
    MongooseModule,
  ],
})
export class OrderModule {}
