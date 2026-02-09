import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { mongooseGlobalTransformPlugin } from '../../common/utils/mongoose-global-transform.plugin';
import { paginate } from '../../common/utils/paginate.plugin';
export type SubBusinessTypeDocument = SubBusinessType & Document;

@Schema({ timestamps: true })
export class SubBusinessType {
  @Prop({ type: Types.ObjectId, ref: "DropdownOption", required: true })
  businessType: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;
}
export const SubBusinessTypeSchema = SchemaFactory.createForClass(SubBusinessType);
SubBusinessTypeSchema.plugin(mongooseGlobalTransformPlugin);
SubBusinessTypeSchema.plugin(paginate);

SubBusinessTypeSchema.index({ businessType: 1 }, { unique: true });


