import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MongooseModule } from '@nestjs/mongoose';
import logger from './common/utils/logger';
import config from './config/config';
import { AdminModule } from './modules/admin/admin.module';
import { BirthdayEventModule } from './modules/birthdayevent/birthdayevent.module';
import { RedisModule } from './modules/redis/redis.module';
import { ReviewModule } from './modules/review/review.module';
import { EventDetailModule } from './modules/eventdetail/eventdetail.module'
import { ThemeModule } from './modules/theme/theme.module';
import { CityModule } from './modules/city/city.module';
import { CategoryModule } from './modules/category/category.module';
import { AddOnModule } from './modules/addOn/addon.module';
import { CartModule } from './modules/cart/cart.module';
import { CartItemModule } from './modules/carts/cart.module';
import { OrderModule } from './modules/order/order.module';
import { DropdownModule } from './modules/dynamicDropdowns/dropdown.module';
import { DraftCartModule } from './modules/carts/draft-cart/draft-cart.module'
import { CouponModule } from './modules/coupon/coupon.module';
import { SubBusinessTypeModule } from './modules/subBusinesstype/subBusinesstype.module';
import { MediaModule } from './modules/home/media/media.module'
import { ExperientialEventModule } from './modules/experientialevent/experientialevent.module';
import { SubExperientialEventCategory } from './modules/subExperientialEventCategory/sub-experiential-event-category.schema';
import { SubExperientialEventCategoryModule } from './modules/subExperientialEventCategory/sub-experiential-event-category.module';
import { VendorModule } from './modules/vendor/vendor.module';
import { VendorAvailabilityModule } from './modules/vendoravailability/vendor-availability.module';
import { EventChangeHistoryModule } from './modules/event-change-history/event-change-history.module';
import { AppConfigModule } from './config/config.module';
import { mongooseConfig } from './config/database/mongoose.config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationModule } from './modules/notification/notification.module';
import { EmailModule } from './modules/email/email.module';
import { ContactUsModule } from './modules/contact-us/contact-us.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { PaymentsModule } from './modules/payments/payments.module'
import { EventsModule } from './events/events.module'
import { BullMqModule } from './providers/queue/bullmq.module';
import { WorkerModule } from './workers/worker.module';
import { BookingpaymentsModule } from './modules/bookingpayments/bookingpayments.module';
import { TalkToExpertModule } from './modules/talk-to-expert/talk-to-expert.module';
import { CustomizePackageModule } from './modules/create-customize-package/create-customize-package.module';
import { PaymentHistoryModule } from './modules/payment-history/payment-history.module';
import { PaymentRulesModule } from './modules/payment-rules/payment-rules.module';
import { BookingsController } from './modules/bookings/bookings.controller';
import { PricingModule } from './modules/pricing/pricing.module';



@Module({
  imports: [
    MongooseModule.forRoot(config.mongodbUrl),
    EventEmitterModule.forRoot(), // REQUIRED
    EventsModule,
    AuthModule,
    AdminModule,
    BullMqModule, //  Redis connection for queues
    NotificationModule, //  API only
    UsersModule,
    AppConfigModule,
    VendorModule,
    PaymentsModule,
    RedisModule,
    ContactUsModule,
    VendorAvailabilityModule,
    BirthdayEventModule,
    ReviewModule,
    EventDetailModule,
    ThemeModule,
    CityModule,
    EventsModule,
    CategoryModule,
    NotificationModule,
    AddOnModule,
    CartModule,
    CartItemModule,
    MediaModule,
    DraftCartModule,
    OrderModule,
    DropdownModule,
    CouponModule,
    SubBusinessTypeModule,
    SubExperientialEventCategoryModule,
    ExperientialEventModule,
    EventChangeHistoryModule,
    MongooseModule.forRootAsync({
      useFactory: mongooseConfig,
    }),
    MediaModule,
    EmailModule,
    ContactUsModule,
    WhatsAppModule,
    WorkerModule, //  Queue processors
     BookingpaymentsModule, TalkToExpertModule, CustomizePackageModule, PaymentHistoryModule, PaymentRulesModule, PricingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((req, res, next) => {
        logger.debug(`[AppModule] Route requested: ${req.method} ${req.url}`);
        next();
      })
      .forRoutes('*');
  }
}

