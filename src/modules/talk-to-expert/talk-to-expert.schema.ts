import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { paginate } from '../../common/utils/paginate.plugin';

import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { mongooseGlobalTransformPlugin } from '../../common/utils/mongoose-global-transform.plugin';
import { Transform } from 'class-transformer';
import { IsValidObjectIdConstraint } from '../../common/validators/is-valid-objectid.validator';
import { aggregatePaginate } from 'src/common/utils/aggregate-paginate.plugin';
@Schema({ timestamps: true })
export class TalkToExpert extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  phone: string;


  @Prop({
    required: true,
    enum: ['BirthdayEvent', 'ExperientialEvent', 'AddOn'],
  })
  eventCategory: string;

  @Prop({ type: SchemaTypes.ObjectId, required: true, refPath: 'eventCategory' })
  eventId: Types.ObjectId;



  @Prop({ required: true })
  contactMethod: string;

  @Prop({ required: true })
  preferredTime: string;
}

export const TalkToExpertSchema = SchemaFactory.createForClass(TalkToExpert);

// ✅ Plugins (Global Transform & Pagination)
TalkToExpertSchema.plugin(mongooseGlobalTransformPlugin);
TalkToExpertSchema.plugin(aggregatePaginate);
TalkToExpertSchema.plugin(paginate);