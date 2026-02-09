import { Injectable } from '@nestjs/common';
import { FirebaseConfig } from '../../../../config/firebase.config';

export interface PushPayload {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class FirebaseService {
  constructor(
    private readonly firebase: FirebaseConfig,
  ) { }

  async sendPush(payload: PushPayload) {
    const { tokens, title, body, data } = payload;
    console.log('FirebaseService#sendPush', payload);
    return this.firebase.messaging.sendEachForMulticast({
      tokens,
      notification: {
        title,
        body,
      },
      data,
    });
  }
}
