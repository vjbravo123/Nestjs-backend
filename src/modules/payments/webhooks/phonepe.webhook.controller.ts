import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from '../payments.service';

/**
 * ✅ PhonePe Webhook Controller (Server → Server)
 *
 * PhonePe will call this endpoint after payment completion/failure/refund events.
 *
 * IMPORTANT:
 * - PhonePe sends Authorization header
 * - Body contains { event, payload }
 * - Do NOT rely on frontend callback URL for payment success
 */
@Controller('payments/webhook/phonepe')
export class PhonePeWebhookController {
  private readonly logger = new Logger(PhonePeWebhookController.name);

  constructor(private readonly paymentsService: PaymentsService) { }

  @Post()
  @HttpCode(HttpStatus.OK)
  async phonePeWebhook(
    @Body() body: any,
    @Headers('authorization') authorization: string,
    @Req() req: Request,
  ) {
    console.log('================ PHONEPE WEBHOOK CONTROLLER HIT ================');
    console.log('➡️ Incoming request received');
    console.log('➡️ IP:', req.ip);
    console.log('➡️ Method:', req.method);
    console.log('➡️ URL:', req.url);
    console.log('➡️ Authorization header:', authorization);
    console.log('➡️ Headers:', JSON.stringify(req.headers, null, 2));
    console.log('➡️ Raw Body:', JSON.stringify(body, null, 2));

    const startTime = Date.now();

    /* -------------------------------------------------
     * 1️⃣ Initial webhook received log
     * ------------------------------------------------- */
    this.logger.log(
      `🔥 PHONEPE WEBHOOK RECEIVED | ip=${req.ip} | method=${req.method} | url=${req.url} | authPresent=${!!authorization}`,
    );

    /* -------------------------------------------------
     * 2️⃣ Log headers
     * ------------------------------------------------- */
    const headerInfo = {
      authorization: authorization ? 'PRESENT' : 'MISSING',
      contentType: req.headers['content-type'],
      userAgent: req.headers['user-agent'],
    };

    console.log('📋 Parsed Header Info:', headerInfo);

    this.logger.log(`📋 Webhook Headers: ${JSON.stringify(headerInfo)}`);

    /* -------------------------------------------------
     * 3️⃣ Log body
     * ------------------------------------------------- */
    this.logger.log(`📦 Webhook Body: ${JSON.stringify(body)}`);

    /* -------------------------------------------------
     * 4️⃣ Validate body shape
     * ------------------------------------------------- */
    if (!body?.payload) {
      console.warn('⚠️ INVALID WEBHOOK: payload missing');
      console.warn('⚠️ Body received:', JSON.stringify(body));

      this.logger.warn(
        `⚠️ INVALID WEBHOOK: Missing payload | body=${JSON.stringify(body)}`,
      );

      console.log('================ WEBHOOK END (INVALID PAYLOAD) ================');
      return { success: true };
    }

    /* -------------------------------------------------
     * 5️⃣ Extract key info
     * ------------------------------------------------- */
    const event = body?.event;
    const merchantOrderId = body?.payload?.merchantOrderId;
    const state = body?.payload?.state;
    const transactionId = body?.payload?.paymentDetails?.[0]?.transactionId;

    console.log('📩 Extracted Webhook Data:', {
      event,
      merchantOrderId,
      state,
      transactionId,
    });

    this.logger.log(
      `📩 WEBHOOK DETAILS | event=${event} | merchantOrderId=${merchantOrderId} | state=${state} | txnId=${transactionId}`,
    );

    /* -------------------------------------------------
     * 6️⃣ Call service (source of truth)
     * ------------------------------------------------- */
    try {
      console.log('⚙️ Calling paymentsService.handlePhonePeWebhook()');

      this.logger.log(`⚙️ Processing webhook via PaymentsService...`);

      await this.paymentsService.handlePhonePeWebhook(
        body,
        authorization,
      );

      const duration = Date.now() - startTime;

      console.log('✅ paymentsService.handlePhonePeWebhook completed');
      console.log('⏱️ Duration(ms):', duration);

      this.logger.log(
        `✅ WEBHOOK PROCESSED SUCCESSFULLY | merchantOrderId=${merchantOrderId} | duration=${duration}ms`,
      );
    } catch (err) {
      const duration = Date.now() - startTime;

      console.error('❌ ERROR while processing webhook');
      console.error('❌ Error object:', err);
      console.error('⏱️ Duration(ms):', duration);

      this.logger.error(
        `❌ WEBHOOK PROCESSING FAILED | merchantOrderId=${merchantOrderId} | duration=${duration}ms | error=${err instanceof Error ? err.message : String(err)}`,
      );

      this.logger.error(
        `Stack trace: ${err instanceof Error ? err.stack : 'N/A'}`,
      );
    }

    /* -------------------------------------------------
     * 7️⃣ Always return 200
     * ------------------------------------------------- */
    console.log('✅ Responding 200 OK to PhonePe');
    console.log('================ PHONEPE WEBHOOK CONTROLLER END ================');

    this.logger.log(`✅ Webhook response sent: 200 OK`);

    return { success: true };
  }

}
