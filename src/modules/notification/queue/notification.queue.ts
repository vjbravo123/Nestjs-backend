import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, QUEUE_JOBS } from '../../../providers/queue/queue.constants';
import { SendPushJob } from '../../../providers/queue/queue.types';

@Injectable()
export class NotificationQueue {
  constructor(
    @InjectQueue(QUEUE_NAMES.NOTIFICATION)
    private readonly queue: Queue,
  ) { }

  async sendPush(data: SendPushJob) {
    await this.queue.add(QUEUE_JOBS.SEND_PUSH, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: true,
    });
  }
}
