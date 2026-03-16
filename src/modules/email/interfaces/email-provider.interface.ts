import { EmailPayload } from './email-payload.interface';

export interface EmailProvider {
  send(payload: EmailPayload): Promise<void>;
}
