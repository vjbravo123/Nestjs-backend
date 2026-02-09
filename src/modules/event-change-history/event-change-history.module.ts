import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventChangeHistoryService } from './event-change-history.service';
import { EventChangeHistory, EventChangeHistorySchema } from './event-change-history.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: EventChangeHistory.name, schema: EventChangeHistorySchema },
        ]),
    ],
    providers: [EventChangeHistoryService],
    exports: [EventChangeHistoryService],
})
export class EventChangeHistoryModule { }
