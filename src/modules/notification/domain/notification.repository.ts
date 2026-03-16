import { Types } from 'mongoose';

export abstract class NotificationRepository {
    abstract registerToken(
        userId: Types.ObjectId,
        token: string,
        platform: string,
    ): Promise<void>;

    abstract getActiveTokens(userId: Types.ObjectId): Promise<string[]>;

    abstract disableToken(token: string): Promise<void>;
}
