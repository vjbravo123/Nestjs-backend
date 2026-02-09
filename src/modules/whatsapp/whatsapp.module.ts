import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';

import { QUEUE_NAMES } from '../../providers/queue/queue.constants';
import { WhatsAppService } from './domain/whatsapp.service';
import { WhatsAppFacade } from './application/whatsapp.facade';
import { Msg91WhatsAppProvider } from './infrastructure/msg91/msg91.provider';
import { IWhatsAppProvider } from './domain/whatsapp.interface';
import { WhatsAppConfigService } from '../../config/whatsapp.config';

import { WhatsappHandlerRegistry } from './application/whatsapp-handler.registry';
import { BaseWhatsappHandler } from './application/handlers/base-whatsapp.handler';

// handlers
import { UserRegisteredWhatsappHandler } from './application/handlers/user-registered.whatsapp.handler';
import { BookingConfirmedWhatsappHandler } from './application/handlers/booking-confirmed.whatsapp.handler';
import { BookingUpdatedWhatsappHandler } from './application/handlers/booking-updated.whatsapp.handler';
import { BookingCancelledWhatsappHandler } from './application/handlers/booking-cancelled.whatsapp.handler';
import { BookingCompletedWhatsappHandler } from './application/handlers/booking-completed.whatsapp.handler';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.WHATSAPP }),
  ],
  providers: [
    WhatsAppConfigService,
    {
      provide: 'IWhatsAppProvider',
      useClass: Msg91WhatsAppProvider,
    },
    {
      provide: WhatsAppService,
      useFactory: (provider: IWhatsAppProvider) => new WhatsAppService(provider),
      inject: ['IWhatsAppProvider'],
    },
    WhatsAppFacade,

    // ✅ Handlers providers
    UserRegisteredWhatsappHandler,
    BookingConfirmedWhatsappHandler,
    BookingUpdatedWhatsappHandler,
    BookingCancelledWhatsappHandler,
    BookingCompletedWhatsappHandler,

    // ✅ Provide list of handlers as array
    {
      provide: 'WHATSAPP_HANDLERS',
      useFactory: (
        user: UserRegisteredWhatsappHandler,
        confirmed: BookingConfirmedWhatsappHandler,
        updated: BookingUpdatedWhatsappHandler,
        cancelled: BookingCancelledWhatsappHandler,
        completed: BookingCompletedWhatsappHandler,
      ): BaseWhatsappHandler[] => {
        return [user, confirmed, updated, cancelled, completed];
      },
      inject: [
        UserRegisteredWhatsappHandler,
        BookingConfirmedWhatsappHandler,
        BookingUpdatedWhatsappHandler,
        BookingCancelledWhatsappHandler,
        BookingCompletedWhatsappHandler,
      ],
    },

    // ✅ Registry
    WhatsappHandlerRegistry,
  ],
  exports: [WhatsAppFacade, WhatsAppService, WhatsAppConfigService, WhatsappHandlerRegistry],
})
export class WhatsAppModule {}
