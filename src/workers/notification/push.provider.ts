import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseConfig } from '../../config/firebase.config'; // adjust path

export interface PushSendResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

@Injectable()
export class PushProvider {
  private readonly logger = new Logger(PushProvider.name);

  constructor(private readonly firebaseConfig: FirebaseConfig) {} // ✅ Inject FirebaseConfig

  async send(payload: {
    tokens: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<PushSendResult> {
    if (!payload.tokens || payload.tokens.length === 0) {
      this.logger.warn('No FCM tokens provided.');
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    const message: admin.messaging.MulticastMessage = {
      tokens: payload.tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data ?? {},
    };

    try {
      // ✅ Use firebaseConfig.messaging (lazy initialized)
      const messaging = this.firebaseConfig.messaging;
      const response = await messaging.sendEachForMulticast(message);

      const invalidTokens: string[] = [];

      response.responses.forEach((res, index) => {
        if (!res.success) {
          const errorCode = res.error?.code;
          if (
            errorCode === 'messaging/registration-token-not-registered' ||
            errorCode === 'messaging/invalid-argument'
          ) {
            this.logger.warn(`Invalid or expired FCM token: ${payload.tokens[index]}`);
            invalidTokens.push(payload.tokens[index]);
          } else {
            this.logger.error(
              `Push failed for token ${payload.tokens[index]} | code=${errorCode} | message=${res.error?.message}`,
            );
          }
        }
      });

      this.logger.log(
        `Push result → success=${response.successCount}, failed=${response.failureCount}`,
      );

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        invalidTokens,
      };
    } catch (err) {
      this.logger.error('Error sending push notifications', err as any);
      return { successCount: 0, failureCount: payload.tokens.length, invalidTokens: [] };
    }
  }
}
