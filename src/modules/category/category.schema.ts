import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { mongooseGlobalTransformPlugin } from '../../common/utils/mongoose-global-transform.plugin'
import { paginate } from '../../common/utils/paginate.plugin';
@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  name: string;
  @Prop({ trim: true, })
  icon: string;
  @Prop({ default: true })
  isActive: boolean;
}
export type CouponDocument = Category & Document;
export const CategorySchema = SchemaFactory.createForClass(Category);
CategorySchema.plugin(mongooseGlobalTransformPlugin);
CategorySchema.plugin(paginate);
