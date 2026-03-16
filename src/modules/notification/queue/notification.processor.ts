import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_NAMES, QUEUE_JOBS } from '../../../providers/queue/queue.constants';
import { SendPushJob } from '../../../providers/queue/queue.types';
import { FirebaseService } from '../infrastructure/firebase/firebase.service';
import { NotificationRepository } from '../domain/notification.repository';
import { Inject } from '@nestjs/common';

@Processor(QUEUE_NAMES.NOTIFICATION)
export class NotificationProcessor extends WorkerHost {
  constructor(
    private readonly firebaseService: FirebaseService,
    @Inject('NotificationRepository')
    private readonly notificationRepo: NotificationRepository,
  ) {
    super();
  }

  async process(job: Job<SendPushJob>): Promise<void> {
    try {
      switch (job.name) {
        case QUEUE_JOBS.SEND_PUSH:
          await this.handleSendPush(job.data);
          break;

        default:
          throw new Error(`Unknown job: ${job.name}`);
      }
    } catch (error) {
      console.error(
        `❌ Notification job failed [JobId=${job.id}]`,
        error.message,
      );
      throw error; // enables retry
    }
  }

  private async handleSendPush(data: SendPushJob): Promise<void> {
    const { userId, title, body, data: extraData } = data;

    // Get user's FCM tokens from repository
    const tokens = await this.notificationRepo.getActiveTokens(userId);

    if (tokens.length === 0) {
      console.log(`⚠️ No FCM tokens found for user: ${userId}`);
      return;
    }

    await this.firebaseService.sendPush({
      tokens,
      title,
      body,
      data: extraData,
    });

    console.log('✅ Push sent for user:', userId);
  }
}
