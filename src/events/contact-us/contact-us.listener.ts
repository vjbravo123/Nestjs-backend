import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { EmailService } from '../../modules/email/email.service';
import { WhatsAppFacade } from '../../modules/whatsapp/application/whatsapp.facade';
import { WhatsAppConfigService } from '../../config/whatsapp.config';
import logger from '../../common/utils/logger';

@Injectable()
export class ContactUsEventsListener {
  constructor(
    private readonly emailService: EmailService,
    private readonly whatsappFacade: WhatsAppFacade,
    private readonly whatsappConfig: WhatsAppConfigService,
  ) { }

  /**
   * CONTACT US CREATED EVENT
   */
  @OnEvent('contactus.created', { async: true })
  async handleContactUs(payload: {
    contactId: string;
    fullName: string;        // ✅ CORRECT
    email: string;
    mobile: string;
    city?: string;
    message?: string;
    createdAt?: string;
  }) {
    const startTime = Date.now();

    logger.info(
      `📩 [ContactUs Listener] Event received | contactId=${payload.contactId} | name=${payload.fullName} | mobile=${payload.mobile}`,
    );

    logger.debug(
      `[ContactUs Listener] Payload | ${JSON.stringify(payload)}`,
    );

    /**
       * ----------------------------------------
       * 1️⃣ Send WhatsApp notification to Admin
       * ----------------------------------------
       * MSG91 Template: contact_us
       * Variables:
       * {{1}} -> fullName
       * {{2}} -> mobile
       * {{3}} -> email
       */
    // try {
    //     logger.info(
    //         `[ContactUs Listener] Sending WhatsApp alert | to=919514338368`,
    //     );

    //     const jobId = await this.whatsappFacade.sendTemplateMessage({
    //         to: '919514338368', // ✅ Your WhatsApp number
    //         template: 'contact_us', // ✅ EXACT MSG91 template name
    //         language: 'en',
    //         namespace: 'ea16c768_3401_4afe_aaa3_34759654ba31', // ✅ REQUIRED
    //         variables: [
    //             payload.fullName, // body_1 → {{1}}
    //             payload.mobile,   // body_2 → {{2}}
    //             payload.email,    // body_3 → {{3}}
    //         ],
    //         meta: {
    //             type: 'CONTACT_US',
    //             contactId: payload.contactId,
    //             timestamp:
    //                 payload.createdAt || new Date().toISOString(),
    //         },
    //     });

    //     logger.info(
    //         `✅ [ContactUs Listener] WhatsApp queued successfully | contactId=${payload.contactId} | jobId=${jobId} | duration=${Date.now() - startTime}ms`,
    //     );
    // } catch (error) {
    //     logger.error(
    //         `❌ [ContactUs Listener] WhatsApp failed | contactId=${payload.contactId}`,
    //         error,
    //     );
    // }
    /**
     *
     *
     *
     * ----------------------------------------
     * 2️⃣ Email to Admin
     * ----------------------------------------
     */
    this.emailService
      .sendContactUsAlertEmail({
        contactId: payload.contactId,
        fullName: payload.fullName,   // ✅ MATCHES SERVICE
        email: payload.email,
        mobile: payload.mobile,
        city: payload.city,
        message: payload.message,
        createdAt: payload.createdAt,
      })
      .catch(err =>
        logger.error(
          '[ContactUs Listener] Failed to send admin email',
          err,
        ),
      );
  }
}
