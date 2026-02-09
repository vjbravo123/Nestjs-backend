import { Injectable } from '@nestjs/common';
import { CounterService } from '../../counters/counter.service';

@Injectable()
export class OrderNumberService {
    constructor(private readonly counterService: CounterService) { }

    /**
     * Returns a unique sequential order number.
     * Atomic + transaction safe.
     */
    async getNextOrderNumber(session?: any): Promise<string> {
        const sequence = await this.counterService.getNextSequence('order', session);

        const year = new Date().getFullYear();
        return `ORD-${year}-${String(sequence).padStart(6, '0')}`;
    }
}
