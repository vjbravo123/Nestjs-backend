import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { mongooseGlobalTransformPlugin } from '../../common/utils/mongoose-global-transform.plugin';
import { paginate } from '../../common/utils/paginate.plugin';

@Schema({ timestamps: true })
export class Review {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'BirthdayEvent', required: true, index: true })
  event: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Order', required: true, index: true })
  orderId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  user: MongooseSchema.Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ type: String })
  comment?: string;

  @Prop({ type: String, enum: ['pending', 'reject', 'approve'], default: 'pending' })
  status?: 'pending' | 'reject' | 'approve';

  @Prop({ type: String })
  image?: string; // URL or path to the review image
}

export type ReviewDocument = Review & Document;
export const ReviewSchema = SchemaFactory.createForClass(Review);

// Apply plugins
ReviewSchema.plugin(mongooseGlobalTransformPlugin);
ReviewSchema.plugin(paginate);
