import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { mongooseGlobalTransformPlugin } from '../../common/utils/mongoose-global-transform.plugin';
import { paginate } from '../../common/utils/paginate.plugin';

// ✅ Strong typing instead of extending Document
export type CartDocument = HydratedDocument<Cart>;

@Schema({ timestamps: true })
export class Cart {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'BirthdayEvent', required: true })
  event: Types.ObjectId;

  @Prop({ required: true })
  eventTitle: string;

  @Prop({ type: SchemaTypes.ObjectId, required: true })
  selectedTierId: Types.ObjectId;

  @Prop({ type: [SchemaTypes.ObjectId], ref: 'AddOn', default: [] })
  addOnIds: Types.ObjectId[];

  @Prop()
  eventBookingDate?: Date;

  @Prop()
  eventDate?: string;

  @Prop()
  eventTime?: string;

  @Prop({ type: SchemaTypes.ObjectId })
  addressId?: Types.ObjectId;

  @Prop()
  guests?: number;
  @Prop()
  plannerPrice?: number;
  @Prop()
  discountedPrice: number;

  @Prop()
  location?: string;

  @Prop({ default: 'active', enum: ['active', 'ordered'] })
  status: 'active' | 'ordered';

  @Prop({ default: 0 })
  itemTotal?: number;
}

export const CartSchema = SchemaFactory.createForClass(Cart);

// ✅ Register plugins with modern typing
CartSchema.plugin(mongooseGlobalTransformPlugin);
CartSchema.plugin(paginate);
