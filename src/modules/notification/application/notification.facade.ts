import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { QUEUE_NAMES, QUEUE_JOBS } from '../../../providers/queue/queue.constants';
import { NotificationRepository } from '../domain/notification.repository';
import { ObjectId } from 'mongoose';

@Injectable()
export class NotificationFacade {
  private readonly logger = new Logger(NotificationFacade.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.NOTIFICATION)
    private readonly notificationQueue: Queue,
    private readonly repo: NotificationRepository,
  ) { }

  async registerToken(
    userId: Types.ObjectId,
    token: string,
    platform: 'ios' | 'android' | 'web',
  ): Promise<void> {
    await this.repo.registerToken(userId, token, platform);
  }

  /**
   * Enqueue push notification
   * @returns jobId (tracking handle)
   */
 async sendPush(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<string | null> {

  // 1️⃣ Fetch active FCM tokens FIRST
  const tokens = await this.repo.getActiveTokens(
    new Types.ObjectId(userId),
  );
  console.log("Fetched FCM  tokens:", tokens);

  // 2️⃣ 🚫 NO TOKENS → DO NOT ENQUEUE
  if (!tokens || tokens.length === 0) {
    this.logger.warn(
      `⚠️ Push skipped | userId=${userId} | reason=NO_FCM_TOKENS`,
    );
    return null;
  }

  // 3️⃣ Enqueue ONLY when tokens exist
  const job = await this.notificationQueue.add(
    QUEUE_JOBS.SEND_PUSH,
    {
      tokens,        // 🔥 REQUIRED
      title,
      body,
      data,
    },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  );

  this.logger.log(
    `📥 Push job queued | jobId=${job.id} | tokens=${tokens.length}`,
  );

  return job.id as string;
}

}
