import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { paginate } from 'src/common/utils/paginate.plugin';
import { mongooseGlobalTransformPlugin } from 'src/common/utils/mongoose-global-transform.plugin';

export type StateDocument = HydratedDocument<State>;

@Schema({ timestamps: true })
export class State {
  @Prop({ type: String, required: true, trim: true })
  state!: string;

  @Prop({ type: String, required: true, trim: true })
  country!: string;

  @Prop({ type: String, trim: true })
  formattedAddress?: string;

  @Prop({ type: Number, required: true })
  lat!: number;

  @Prop({ type: Number, required: true })
  lng!: number;

  @Prop({ type: String, required: true, unique: true })
  place_id!: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'City' }], default: [] })
  cities!: Types.ObjectId[];

  @Prop({ type: Boolean, default: true })
  active!: boolean;

  @Prop({ type: Boolean, default: false })
  isDeleted!: boolean;
}

export const StateSchema = SchemaFactory.createForClass(State);
StateSchema.index({ state: 1 }, { unique: true });
StateSchema.plugin(paginate);
StateSchema.plugin(mongooseGlobalTransformPlugin);
