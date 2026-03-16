import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_NAMES, QUEUE_JOBS } from '../../providers/queue/queue.constants';
import { SendWhatsAppJob } from '../../providers/queue/queue.types';
import { WhatsAppConfigService } from '../../config/whatsapp.config';
import logger from '../../common/utils/logger';

@Processor(QUEUE_NAMES.WHATSAPP)
export class WhatsAppProcessor extends WorkerHost {
    constructor(private readonly config: WhatsAppConfigService) {
        super();
    }

    async process(job: Job<SendWhatsAppJob>) {
        const startTime = Date.now();
        const contactId = job.data.meta?.contactId || 'unknown';
        const attemptNumber = job.attemptsMade + 1;

        logger.info(
            `⚙️ [WhatsApp Worker] Processing job | jobId=${job.id} | template=${job.data.template} | to=${job.data.to} | contactId=${contactId} | attempt=${attemptNumber}/3`,
        );
        logger.debug(
            `[WhatsApp Worker] Job data | ${JSON.stringify({ template: job.data.template, variableCount: job.data.variables?.length || 0, meta: job.data.meta })}`,
        );

        try {
            switch (job.name) {
                case QUEUE_JOBS.SEND_WHATSAPP: {
                    logger.info(
                        `[WhatsApp Worker] Sending template message | jobId=${job.id} | contactId=${contactId}`,
                    );

                    const result = await this.sendWhatsAppTemplate(job);
                    const duration = Date.now() - startTime;

                    logger.info(
                        `📱 [WhatsApp Worker] Message SENT successfully | jobId=${job.id} | messageId=${result.messageId} | to=${job.data.to} | contactId=${contactId} | duration=${duration}ms`,
                    );

                    logger.info(
                        `✅ [WhatsApp Worker] Job completed | jobId=${job.id} | contactId=${contactId} | status=SUCCESS`,
                    );

                    return {
                        status: 'SENT',
                        messageId: result.messageId,
                        meta: job.data.meta,
                        duration,
                        attempt: attemptNumber,
                    };
                }

                default:
                    logger.error(
                        `[WhatsApp Worker] Unknown job type | jobId=${job.id} | jobName=${job.name}`,
                    );
                    throw new Error(`Unknown job name: ${job.name}`);
            }
        } catch (error) {
            const duration = Date.now() - startTime;

            logger.error(
                `❌ [WhatsApp Worker] Job FAILED | jobId=${job.id} | contactId=${contactId} | attempt=${attemptNumber}/3 | duration=${duration}ms | error=${error.message}`,
            );
            logger.error(
                `[WhatsApp Worker] Error details | jobId=${job.id}`,
                error,
            );

            if (attemptNumber < 3) {
                logger.warn(
                    `🔄 [WhatsApp Worker] Job will be retried | jobId=${job.id} | contactId=${contactId} | nextAttempt=${attemptNumber + 1}/3`,
                );
            } else {
                logger.error(
                    `💀 [WhatsApp Worker] Job failed permanently | jobId=${job.id} | contactId=${contactId} | allAttemptsExhausted=true`,
                );
            }

            throw error; // Retry
        }
    }

    private async sendWhatsAppTemplate(job: Job<SendWhatsAppJob>) {
        const { to, template, language, namespace, variables, meta } = job.data;

        // Build MSG91 components from variables
        const components: any = {};
        if (variables && variables.length > 0) {
            variables.forEach((value, index) => {
                components[`body_${index + 1}`] = {
                    type: 'text',
                    value: String(value),
                };
            });
        }

        // Send via MSG91
        const response = await this.sendViaMSG91({
            to,
            templateName: template,
            languageCode: language || 'en_US',
            namespace: namespace || this.config.msg91TemplateNamespace,
            components,
        });

        return response;
    }

    private normalizeIndianMobile(to: string): string {
        // remove spaces, +, -, brackets etc.
        let num = String(to).replace(/\D/g, '');

        // ✅ if 10 digit -> add India country code
        if (num.length === 10) {
            num = '91' + num;
        }

        // ✅ if starts with 0 and 11 digits like 0XXXXXXXXXX -> remove 0 and add 91
        if (num.length === 11 && num.startsWith('0')) {
            num = '91' + num.slice(1);
        }

        // ✅ final validation
        // India numbers should be 12 digits with 91
        if (!(num.length === 12 && num.startsWith('91'))) {
            throw new Error(
                `Invalid WhatsApp mobile number. Expected 10-digit or 91XXXXXXXXXX format. Got: ${to} => ${num}`,
            );
        }

        return num;
    }

    private async sendViaMSG91(params: {
        to: string;
        templateName: string;
        languageCode: string;
        namespace: string;
        msg91IntegratedNumber?: string;
        components: any;
    }) {
        const axios = require('axios');

        // ✅ normalize first
        const normalizedTo = this.normalizeIndianMobile(params.to);

        const payload = {
            integrated_number:
                params.msg91IntegratedNumber || this.config.msg91IntegratedNumber,
            content_type: 'template',
            payload: {
                messaging_product: 'whatsapp',
                type: 'template',
                template: {
                    name: params.templateName,
                    language: {
                        code: params.languageCode,
                        policy: 'deterministic',
                    },
                    namespace: params.namespace,
                    to_and_components: [
                        {
                            to: [normalizedTo], // ✅ always 91xxxxxxxxxx
                            components: params.components,
                        },
                    ],
                },
            },
        };

        const apiStartTime = Date.now();

        logger.debug(
            `[WhatsApp Worker] MSG91 API Request | template=${params.templateName} | to=${normalizedTo}`,
        );
        logger.debug(`[WhatsApp Worker] MSG91 Payload: ${JSON.stringify(payload, null, 2)}`);

        try {
            const response = await axios.post(
                'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/',
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        authkey: this.config.msg91AuthKey,
                    },
                },
            );

            const apiDuration = Date.now() - apiStartTime;

            logger.info(
                `[WhatsApp Worker] MSG91 API Response | status=${response.status} | duration=${apiDuration}ms`,
            );
            logger.debug(
                `[WhatsApp Worker] MSG91 Response Data: ${JSON.stringify(response.data)}`,
            );

            return {
                success: true,
                // ✅ MSG91 gives request_id mostly
                messageId:
                    response.data?.request_id ||
                    response.data?.messageId ||
                    response.data?.id,
                rawResponse: response.data,
            };
        } catch (error) {
            const apiDuration = Date.now() - apiStartTime;

            logger.error(
                `[WhatsApp Worker] MSG91 API Error | duration=${apiDuration}ms | status=${error.response?.status} | error=${error.message}`,
            );
            logger.error(`[WhatsApp Worker] MSG91 Error Response:`, error.response?.data);

            throw error;
        }
    }

}
