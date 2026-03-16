import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AppConfigModule } from '../config/config.module';

import { EmailProcessor } from './email/email.processor';
import { NotificationProcessor } from './notification/notification.processor';
import { WhatsAppProcessor } from './whatsapp/whatsapp.processor';
import { NotificationQueueEvents } from './notification/notification.queue-events';

import { SmtpProvider } from '../modules/email/providers/smtp.provider';
import { PushProvider } from './notification/push.provider';
import { Msg91Service } from '../services/sms.service';
import { WhatsAppConfigService } from '../config/whatsapp.config';

import {
  NotificationToken,
  NotificationTokenSchema,
} from '../modules/notification/infrastructure/persistence/notification.schema';

import { NotificationRepositoryMongo } from '../modules/notification/infrastructure/persistence/notification.repository.mongo';
import { FirebaseConfig } from '../config/firebase.config';

@Module({
  imports: [
    AppConfigModule,
    // ❌ REMOVED: Don't call forRootAsync here - BullMqModule already does this globally
    // Workers will inherit the global Redis configuration from BullMqModule
    MongooseModule.forRoot(process.env.MONGODB_URL!),
    MongooseModule.forFeature([
      { name: NotificationToken.name, schema: NotificationTokenSchema },
    ]),
  ],
  providers: [
    EmailProcessor,
    NotificationProcessor,
    WhatsAppProcessor,
    SmtpProvider,
    Msg91Service,
    WhatsAppConfigService, // ✅ Validates WhatsApp env vars on startup
    FirebaseConfig, // ✅ Provide FirebaseConfig
    NotificationQueueEvents,
    PushProvider, // ✅ Injects FirebaseConfig
    {
      provide: 'NotificationRepository',
      useClass: NotificationRepositoryMongo,
    },
  ],
})
export class WorkerModule {}
