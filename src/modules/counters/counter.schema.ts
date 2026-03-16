import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes } from 'mongoose';

@Schema({ collection: 'counters' })
export class Counter {
  @Prop({ type: String, required: true, unique: true })
  key: string;

  @Prop({ type: Number, default: 0 })
  value: number;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);
