import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_NAMES, QUEUE_JOBS } from '../../../../providers/queue/queue.constants';
import { NotificationService } from '../../domain/notification.service';

@Processor(QUEUE_NAMES.NOTIFICATION)
export class NotificationProcessor extends WorkerHost {
  constructor(
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    try {
      switch (job.name) {
        case QUEUE_JOBS.SEND_PUSH:
          await this.handlePush(job);
          break;

        default:
          throw new Error(`Unknown job: ${job.name}`);
      }
    } catch (error) {
      console.error(
        `❌ Notification job failed [id=${job.id}]`,
        error.message,
      );
      throw error; // enables retry
    }
  }

  private async handlePush(job: Job) {
    const { userId, payload } = job.data;

    await this.notificationService.sendPush(
      userId,
      payload,
    );
  }
}
