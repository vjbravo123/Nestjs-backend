import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { NotificationController } from './presentation/notification.controller';
import { NotificationFacade } from './application/notification.facade';

import {
  NotificationToken,
  NotificationTokenSchema,
} from './infrastructure/persistence/notification.schema';

import { NotificationRepository } from './domain/notification.repository';
import { NotificationRepositoryMongo } from './infrastructure/persistence/notification.repository.mongo';

import { NotificationQueue } from './queue/notification.queue';
import { QUEUE_NAMES } from '../../providers/queue/queue.constants';

@Module({
  imports: [
    ConfigModule,
    // Register queue - inherits global Redis connection from BullMqModule
    BullModule.registerQueue({
      name: QUEUE_NAMES.NOTIFICATION,
    }),

    MongooseModule.forFeature([
      { name: NotificationToken.name, schema: NotificationTokenSchema },
    ]),
  ],

  controllers: [NotificationController],

  providers: [
    NotificationFacade,
    NotificationQueue, // ✅ Only queue (adds jobs), NO processor here

    // ✅ CORRECT DI BINDING
    {
      provide: NotificationRepository,
      useClass: NotificationRepositoryMongo,
    },
  ],

  exports: [NotificationFacade, NotificationQueue],
})
export class NotificationModule {}
