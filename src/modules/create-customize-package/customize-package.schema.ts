import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { paginate } from 'src/common/utils/paginate.plugin';
import { mongooseGlobalTransformPlugin } from '../../common/utils/mongoose-global-transform.plugin';

@Schema({ timestamps: true })
export class CustomizePackage extends Document {
  @Prop({ required: true })
  name: string;


  @Prop({
    required: true,
    enum: ['BirthdayEvent', 'ExperientialEvent', 'AddOn'],
  })
  eventCategory: string;

  @Prop({ type: SchemaTypes.ObjectId, required: true, refPath: 'eventCategory' })
  eventId: Types.ObjectId;


  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  venueSizeCount: number;

  @Prop({})
  preferredDate?: string;

  @Prop({ required: true })
  budgetRange: string;

  @Prop({ type: [String], default: [] })
  modifications: string[];

  @Prop({ default: 'PENDING' })
  status: string;
}

export const CustomizePackageSchema =
  SchemaFactory.createForClass(CustomizePackage);

CustomizePackageSchema.plugin(mongooseGlobalTransformPlugin);
CustomizePackageSchema.plugin(paginate)
CustomizePackageSchema.index({ eventCategory: 1 })