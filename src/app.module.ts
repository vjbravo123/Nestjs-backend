import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import logger from './common/utils/logger';
import config from './config/config';
import { AdminModule } from './modules/admin/admin.module';
import { BirthdayEventModule } from './modules/birthdayevent/birthdayevent.module';
import { RedisModule } from './modules/redis/redis.module';
import { ReviewModule } from './modules/review/review.module';
import { TalkToExpertModule } from './modules/talk-to-expert/talk-to-expert.module'
import { EventDetailModule } from './modules/eventdetail/eventdetail.module'
import { ThemeModule } from './modules/theme/theme.module';
import { CityModule } from './modules/city/city.module';
import { StateModule } from './modules/state/state.module';
import { CategoryModule } from './modules/category/category.module';
import { AddOnModule } from './modules/addOn/addon.module';
import { CartModule } from './modules/cart/cart.module';
import { CartItemModule } from './modules/carts/cart.module';
import { OrderModule } from './modules/order/order.module';
import { DropdownModule } from './modules/dynamicDropdowns/dropdown.module';
import { BookingPaymentsModule } from './modules/booking-payments/booking-payments.module'
import { DraftCartModule } from './modules/carts/draft-cart/draft-cart.module'
import { CouponModule } from './modules/coupon/coupon.module';
import { SubBusinessTypeModule } from './modules/subBusinesstype/subBusinesstype.module';
import { MediaModule } from './modules/home/media/media.module';
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
import { InstallmentModule } from './modules/installments/installment.module'

import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { EventsModule } from './events/events.module';
import { BullMqModule } from './providers/queue/bullmq.module';
import { CustomizePackageModule } from './modules/create-customize-package/create-customize-package.module'
import { WorkerModule } from './workers/worker.module';
import { HealthController } from './common/controllers/health.controller';
import { CaslModule } from './common/casl/casl.module';
import { CommissionModule } from './modules/commission/commission.module'
@Module({
  imports: [
    MongooseModule.forRoot(config.mongodbUrl),
    EventEmitterModule.forRoot({ global: true }),
    // Global rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 100, // 100 requests per minute per IP
      },
    ]),
    CaslModule,
    EventsModule,
    AuthModule,
    AdminModule,
    BullMqModule, //  Redis connection for queues
    NotificationModule, //  API only
    UsersModule,
    AppConfigModule,
    VendorModule,
    PaymentsModule,
    CustomizePackageModule,
    RedisModule,
    ContactUsModule,
    VendorAvailabilityModule,
    BookingPaymentsModule,
    BirthdayEventModule,
    ReviewModule,
    TalkToExpertModule,
    EventDetailModule,
    InstallmentModule,
    ThemeModule,
    CityModule,
    StateModule,
    CategoryModule,
    NotificationModule,
    AddOnModule,
    CartModule,
    CartItemModule,
    MediaModule,
    DraftCartModule,
    OrderModule,
    DropdownModule,
    CommissionModule,
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
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    // Enable global rate limiting
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
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
