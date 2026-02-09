import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  QUEUE_NAMES,
  QUEUE_JOBS,
} from '../../../providers/queue/queue.constants';
import { SendWhatsAppJob } from '../../../providers/queue/queue.types';
import { WhatsAppService } from '../domain/whatsapp.service';

/**
 * WhatsApp Queue Processor
 * Processes WhatsApp message jobs from the queue
 */
@Processor(QUEUE_NAMES.WHATSAPP)
export class WhatsAppProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsAppProcessor.name);

  constructor(private readonly whatsappService: WhatsAppService) {
    super();
  }

  async process(job: Job<SendWhatsAppJob>): Promise<any> {
    this.logger.log(
      `Processing WhatsApp job ${job.id} | template: ${job.data.template}`,
    );

    try {
      if (job.name === QUEUE_JOBS.SEND_WHATSAPP) {
        return await this.handleSendWhatsApp(job);
      }

      this.logger.warn(`Unknown job type: ${job.name}`);
      return { success: false, error: 'Unknown job type' };
    } catch (error) {
      this.logger.error(`Job ${job.id} failed`, error);
      throw error;
    }
  }

  private async handleSendWhatsApp(job: Job<SendWhatsAppJob>) {
    const { to, template, language, variables, meta } = job.data;

    // Build components from variables
    const components: Record<string, any> = {};
    if (variables && variables.length > 0) {
      variables.forEach((value, index) => {
        components[`body_${index + 1}`] = value;
      });
    }

    const result = await this.whatsappService.sendTemplateMessage({
      to,
      templateName: template,
      languageCode: language,
      components,
    });

    if (!result.success) {
      throw new Error(`WhatsApp send failed: ${result.error}`);
    }

    this.logger.log(
      `WhatsApp job ${job.id} completed | messageId: ${result.messageId}`,
    );

    return {
      success: true,
      messageId: result.messageId,
      meta,
    };
  }
}
