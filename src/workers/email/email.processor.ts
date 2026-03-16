import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '../../providers/queue/queue.constants';
import { SendEmailJob } from '../../providers/queue/queue.types';
import { renderTemplate } from '../../modules/email/utils/template-renderer';
import { SmtpProvider } from '../../modules/email/providers/smtp.provider';
import path from 'path';
@Processor(QUEUE_NAMES.EMAIL)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly smtpProvider: SmtpProvider) {
    super();
  }

  /**
   * BullMQ worker entry point
   */
  async process(job: Job<SendEmailJob>) {
    const { to, template, payload, subject } = job.data;

    try {
      this.logger.log(`⚙️ Processing jobId=${job.id}`);
      this.logger.log(`📨 Template=${template}`);

      const normalizedTo = Array.isArray(to) ? to.join(',') : to;

      this.logger.log(`📂 Rendering template...`);
      const html = renderTemplate(template, payload);

      this.logger.log(`📝 Resolving subject...`);
      const resolvedSubject = subject ?? this.resolveSubject(template, payload);

      this.logger.log(`📤 Sending email...`);
      await this.smtpProvider.send({
        to: normalizedTo,
        subject: resolvedSubject,
        html,
      });

      this.logger.log(`✅ Email sent jobId=${job.id}`);
      return { ok: true };
    } catch (error) {
      this.logger.error(`❌ FAILED STEP jobId=${job.id}`);
      this.logger.error(error.stack || error);
      throw error;
    }
  }


  /**
   * Safe subject resolver
   */
  private resolveSubject(template: string, payload?: Record<string, any>): string {
    try {
      const subjectPath = path.join(
        __dirname,
        '..',
        '..',
        'modules',
        'email',
        'templates',
        template,
        `${template}.subject`
      );

      const subjectModule = require(subjectPath);

      if (typeof subjectModule.default === 'string') {
        return subjectModule.default;
      }

      const fn = subjectModule.default ?? Object.values(subjectModule)[0];
      if (typeof fn === 'function') {
        return fn(payload ?? {});
      }

      return String(subjectModule.default ?? 'Notification from Zappy');
    } catch (err) {
      this.logger.warn(`⚠️ Subject missing for ${template}: ${err.message}`);
      return 'Notification from Zappy';
    }
  }

}
