import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EventDetailType = 'highlight' | 'include' | 'policy';

@Schema({ timestamps: true })
export class EventDetail {
    @Prop({ required: true })
    name: string;

    @Prop()
    description?: string;

    @Prop({ required: true, enum: ['highlight', 'include', 'policy'] })
    type: EventDetailType;
}

export type EventDetailDocument = EventDetail & Document;
export const EventDetailSchema = SchemaFactory.createForClass(EventDetail);