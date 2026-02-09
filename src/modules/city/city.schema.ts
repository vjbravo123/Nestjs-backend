import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { paginate } from 'src/common/utils/paginate.plugin';
import { mongooseGlobalTransformPlugin } from 'src/common/utils/mongoose-global-transform.plugin';
export type CityDocument = City & Document;

@Schema({ timestamps: true })
export class City {
  @Prop({ type: String, required: true, trim: true })
  city!: string;

  @Prop({ type: String, required: true, trim: true })
  state!: string;

  @Prop({ type: String, required: true, trim: true })
  country!: string;

  @Prop({ type: String, trim: true })
  district?: string;

  @Prop({ type: String, trim: true })
  name?: string;

  @Prop({ type: String, trim: true })
  formattedAddress?: string;

  @Prop({ type: String, trim: true })
  pincode?: string;

  @Prop({ type: String, default: null })
  neighborhood!: string | null;

  @Prop({ type: String, default: null })
  sublocality!: string | null;

  @Prop({ type: Number, required: true })
  lat!: number;

  @Prop({ type: Number, required: true })
  lng!: number;

  @Prop({ type: String, required: true, unique: true })
  place_id!: string;

  @Prop({ type: Boolean, default: true })
  active!: boolean;


  @Prop({ type: Boolean, default: true })
  isDeleted!: boolean;
}

export const CitySchema = SchemaFactory.createForClass(City);
CitySchema.index({ city: 1 }, { unique: true });
CitySchema.plugin(paginate)
CitySchema.plugin(mongooseGlobalTransformPlugin)