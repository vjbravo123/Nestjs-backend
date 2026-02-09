import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { EmailQueue } from './queue/email.queue';

import { SmtpProvider } from './providers/smtp.provider';
import { EmailAdapter } from './adapters/email.adapter';

import { QUEUE_NAMES } from '../../providers/queue/queue.constants';

@Module({
  imports: [
    ConfigModule,
    // Register queue - inherits global Redis connection from BullMqModule
    BullModule.registerQueue({
      name: QUEUE_NAMES.EMAIL,
    }),
  ],
  controllers: [EmailController],
  providers: [
    EmailService, // business logic
    EmailQueue, // enqueue jobs
    EmailAdapter, // template / mapping
    SmtpProvider, // reusable provider (can also be used by worker)
  ],
  exports: [
    EmailService, // allow other modules to send emails
    EmailQueue, // optional: if other modules enqueue directly
  ],
})
export class EmailModule {}
