import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { OrderEventsListener } from './order/order.event.listener';
import { EmailModule } from '../modules/email/email.module';
import { NotificationModule } from '../modules/notification/notification.module';
import { WhatsAppModule } from '../modules/whatsapp/whatsapp.module';
import { OrderModule } from '../modules/order/order.module';
import { PartnerEventsListener } from './vendor/vendor-event-listener'


import { AuthEventsListener } from './auth/auth-events.listener';
import { NotificationEmailEventsListener } from './alert/notification.email-events.listener';
import { NotificationPushEventsListener } from './alert/notification.push-events.listener';

// ✅ ADD THESE IMPORTS
import { NotificationWhatsappEventsListener } from './alert/notification.whatsapp-events.listener';
import { UserRegisteredWhatsappHandler } from '../modules/whatsapp/application/handlers/user-registered.whatsapp.handler';

import { PaymentSuccessListener } from './payment/payment-success.listener';
import { ContactUsEventsListener } from './contact-us/contact-us.listener';



//  import all whats aap  handler

import { BookingConfirmedWhatsappHandler } from '../modules/whatsapp/application/handlers/booking-confirmed.whatsapp.handler';
import { BookingUpdatedWhatsappHandler } from '../modules/whatsapp/application/handlers/booking-updated.whatsapp.handler';
import { BookingCancelledWhatsappHandler } from '../modules/whatsapp/application/handlers/booking-cancelled.whatsapp.handler';
import { BookingCompletedWhatsappHandler } from '../modules/whatsapp/application/handlers/booking-completed.whatsapp.handler';
@Module({
  imports: [
    EventEmitterModule.forRoot({
      global: true,
    }),
    EmailModule,
    NotificationModule,
    WhatsAppModule,
    OrderModule,
  ],
  providers: [
    // Domain
    AuthEventsListener,
    OrderEventsListener,
    PartnerEventsListener,
    ContactUsEventsListener,
    PaymentSuccessListener,

    // Alerts
    NotificationEmailEventsListener,
    NotificationPushEventsListener,

    // ✅ WhatsApp alert routing + handlers
    NotificationWhatsappEventsListener,
    UserRegisteredWhatsappHandler,
    BookingCompletedWhatsappHandler,
    BookingConfirmedWhatsappHandler,
    BookingCancelledWhatsappHandler,
    BookingUpdatedWhatsappHandler
  ],
})
export class EventsModule { }
