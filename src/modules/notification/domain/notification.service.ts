import { Inject, Injectable } from '@nestjs/common';
import { NotificationRepository } from './notification.repository';
import { NotificationQueue } from '../queue/notification.queue';
import { SendPushJob } from '../../../providers/queue/queue.types';
import { Types } from 'mongoose';

@Injectable()
export class NotificationService {
  constructor(
    @Inject('NotificationRepository')
    private readonly repo: NotificationRepository,
    private readonly notificationQueue: NotificationQueue,
  ) { }

  /**
   * API-level method
   * - validates intent
   * - enqueues push job
   */
  async sendPush(
    userId: Types.ObjectId,
    payload: Omit<SendPushJob, 'userId'>,
  ): Promise<void> {
    await this.notificationQueue.sendPush({
      userId,
      title: payload.title,
      body: payload.body,
      data: payload.data,
    });
  }
}
