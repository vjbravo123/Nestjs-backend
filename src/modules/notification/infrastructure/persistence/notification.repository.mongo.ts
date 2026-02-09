import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationRepository } from '../../domain/notification.repository';
import { NotificationToken } from './notification.schema';
import { Types } from 'mongoose';

@Injectable()
export class NotificationRepositoryMongo
    implements NotificationRepository {
    constructor(
        @InjectModel(NotificationToken.name)
        private readonly model: Model<NotificationToken>,
    ) { }

    async registerToken(
        userId: Types.ObjectId,
        token: string,
        platform: string,
    ) {
        await this.model.updateOne(
            { token },
            {
                $set: {
                    userId,
                    platform,
                    isActive: true,
                    lastUsedAt: new Date(),
                },
            },
            { upsert: true },
        );
    }

    async getActiveTokens(userId: Types.ObjectId): Promise<string[]> {
        const records = await this.model.find({
            userId,
            isActive: true,
        });

        return records.map(r => r.token);
    }

    async disableToken(token: string) {
        await this.model.updateOne(
            { token },
            { $set: { isActive: false } },
        );
    }
}
