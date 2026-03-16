import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Counter } from './counter.schema';

@Injectable()
export class CounterService {
    constructor(
        @InjectModel(Counter.name) private readonly counterModel: Model<Counter>,
    ) { }

    /**
     * Get the next auto-increment number for a given key
     * Atomic + Safe (uses $inc inside findOneAndUpdate)
     */
    async getNextSequence(key: string, session?: any): Promise<number> {
        const result = await this.counterModel.findOneAndUpdate(
            { key },
            { $inc: { value: 1 } },
            {
                new: true,
                upsert: true,
                session, // optional transaction support
                setDefaultsOnInsert: true,
            },
        );

        return result.value;
    }

    /**
     * Reset sequence for a key (Optional utility)
     */
    async resetSequence(key: string, session?: any): Promise<void> {
        await this.counterModel.updateOne(
            { key },
            { $set: { value: 0 } },
            { session },
        );
    }
}
