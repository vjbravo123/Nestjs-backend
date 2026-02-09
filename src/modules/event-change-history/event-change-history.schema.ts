import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { paginate } from 'src/common/utils/paginate.plugin';
import { aggregatePaginate } from 'src/common/utils/aggregate-paginate.plugin';

export type EventChangeHistoryDocument = EventChangeHistory & Document;

@Schema({ timestamps: true })
export class EventChangeHistory {
    @Prop({ type: Types.ObjectId, ref: 'ExperientialEvent', required: true })
    eventId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, refPath: 'changedByRole', required: true })
    changedBy: Types.ObjectId;

    @Prop({ enum: ['admin', 'vendor'], required: true })
    changedByRole: 'admin' | 'vendor';

    // Stores the actual field changes: { fieldName: { old: value, new: value } }
    @Prop({ type: Object, required: true })
    changes: Record<string, { old: any; new: any }>;

    // Optional reason (used for rejected changes)
    @Prop()
    reason?: string;

    // Status of this change: 'pending' | 'approved' | 'rejected'
    @Prop({ enum: ['pending', 'approved', 'rejected'], required: true })
    status: 'pending' | 'approved' | 'rejected';

    // Timestamp when the change happened
    @Prop({ default: Date.now })
    changedAt: Date;
}

export const EventChangeHistorySchema = SchemaFactory.createForClass(EventChangeHistory);
EventChangeHistorySchema.index({ eventId: 1 });
EventChangeHistorySchema.index({ changedBy: 1 });

EventChangeHistorySchema.plugin(aggregatePaginate);
EventChangeHistorySchema.plugin(paginate);
