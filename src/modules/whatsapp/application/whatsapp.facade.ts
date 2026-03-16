import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Injectable } from '@nestjs/common';
import {
  QUEUE_NAMES,
  QUEUE_JOBS,
} from '../../../providers/queue/queue.constants';
import { SendWhatsAppJob } from '../../../providers/queue/queue.types';
import logger from '../../../common/utils/logger';

/**
 * Application Facade for WhatsApp Operations
 * Handles queuing and orchestration of WhatsApp messages
 */
@Injectable()
export class WhatsAppFacade {
  constructor(
    @InjectQueue(QUEUE_NAMES.WHATSAPP)
    private readonly whatsappQueue: Queue,
  ) { }

  /**
   * Send WhatsApp template message (queued)
   * @returns jobId for tracking
   */
  async sendTemplateMessage(params: {
    to: string;
    template: string;
    language?: string;
    namespace?: string;
    variables?: string[];
    meta?: Record<string, any>;
  }): Promise<string> {
    const startTime = Date.now();
    const contactId = params.meta?.contactId;

    logger.info(
      `[WhatsApp Facade] Queueing template message | template=${params.template} | to=${params.to} | contactId=${contactId}`,
    );
    logger.debug(
      `[WhatsApp Facade] Job params | ${JSON.stringify({ ...params, variables: params.variables?.length || 0 })}`,
    );

    const jobData: SendWhatsAppJob = {
      to: params.to,
      template: params.template,
      language: params.language || 'en',
      namespace: params.namespace,
      variables: params.variables || [],
      meta: params.meta,
    };

    try {
      const job = await this.whatsappQueue.add(
        QUEUE_JOBS.SEND_WHATSAPP,
        jobData,
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      const duration = Date.now() - startTime;

      logger.info(
        `[WhatsApp Facade] Job queued successfully | jobId=${job.id} | template=${params.template} | contactId=${contactId} | duration=${duration}ms`,
      );

      logger.debug(
        `[WhatsApp Facade] Job details | jobId=${job.id} | attempts=3 | backoff=exponential(5000ms)`,
      );

      return job.id as string;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error(
        `[WhatsApp Facade] Failed to queue job | template=${params.template} | contactId=${contactId} | duration=${duration}ms | error=${error.message}`,
      );
      logger.error(`[WhatsApp Facade] Error stack`, error);

      throw error;
    }
  }

  /**
   * Send WhatsApp notification (convenience method)
   */
  async sendNotification(params: {
    to: string;
    template: string;
    language?: string;
    namespace?: string;
    variables?: string[];
    meta?: Record<string, any>;
  }): Promise<string> {
    return this.sendTemplateMessage(params);
  }
}
