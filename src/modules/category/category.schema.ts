import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
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
export type CouponDocument = HydratedDocument<Category>;
export const CategorySchema = SchemaFactory.createForClass(Category);
CategorySchema.plugin(mongooseGlobalTransformPlugin);
CategorySchema.plugin(paginate);
