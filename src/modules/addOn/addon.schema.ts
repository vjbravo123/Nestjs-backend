import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { mongooseGlobalTransformPlugin } from '../../common/utils/mongoose-global-transform.plugin';
import { paginate } from '../../common/utils/paginate.plugin';
import { Transform } from 'class-transformer';
import { IsValidObjectIdConstraint } from '../../common/validators/is-valid-objectid.validator';
import { aggregatePaginate } from 'src/common/utils/aggregate-paginate.plugin';
import { IsOptional, IsString } from 'class-validator';

export type AddOnDocument = HydratedDocument<AddOn>;

@Schema({ timestamps: true, versionKey: false })
export class AddOn {
  // 🏷️ Name of the add-on
  @Prop({ required: true, trim: true })
  name: string;

  // 🏙️ Cities where the add-on is available
  @Prop({
    type: [
      {
        name: { type: String },
        maxBookingsPerDay: { type: Number },
        _id: false, // disable auto _id
      },
    ],
    default: undefined,
  })
  cityOfOperation?: Array<{
    name: string;
    maxBookingsPerDay: number;
  }>;

  // 🔖 Tags for searching / filtering
  @Prop({ trim: true })
  tags?: string;


  @Prop({ default: false })
  isBlock: boolean;

  // 🧾 Optional description
  @Prop({ trim: true })
  description?: string;

  // 🗂️ Linked category (reference to Category model)
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Category' })
  @Transform(({ value }) => (Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value))
  category: Types.ObjectId;


  @Prop({
    type: [
      {
        price: { type: Number, required: true },
        name: { type: String, required: true },
        duration: { type: String, required: false },
        description: { type: String, required: true },
        guest: { type: String, },
        features: { type: [String], required: true },
      },
    ],
    default: undefined,
  })
  tiers: Array<{
    price: number;
    name: string;
    description: string;
    guest?: string;
    duration: string;
    features: string[];
  }>;
  // 💰 Price per booking / item
  @Prop({ min: 0 })
  price: number;

  // 🔢 Maximum number of bookings per day
  @Prop({ type: Number, default: 1, min: 1 })
  maxBookingsPerDay?: number;

  // ⏱️ Duration in hours or string format like "2h" or "30min"
  @Prop({ type: String, trim: true })
  duration?: string;

  // 📦 Maximum quantity allowed per booking
  @Prop({ type: Number, default: 1, min: 1 })
  maxQuantity?: number;

  // 🧾 Whether the add-on is available for booking

  // 🖼️ Simple banner URLs
  @Prop({ type: [String], default: undefined })
  banner?: string[];

  // 🧩 Detailed banner objects (array of banner details)
  // @Prop({
  //   type: [
  //     {
  //       image: { type: String, required: true }, // URL or path to image
  //       title: { type: String, trim: true, required: false },
  //       order: { type: Number, default: 0 }, // optional ordering
  //     },
  //   ],
  //   default: [],
  // })
  // bannerDetails?: {
  //   image: string;
  //   title?: string;
  //   order?: number;
  // }[];

  // ⭐ Whether this add-on is popular
  @Prop({ type: Boolean, default: false })
  popular?: boolean;

  // ✅ Active / inactive status
  @Prop({ type: Boolean, default: false })
  isActive?: boolean;

  // 🧑‍💼 Vendor who created this add-on
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Vendor', required: false })
  createdBy?: Types.ObjectId;


  @Prop({ type: String, trim: true })
  exclusion?: string;

  // 🧾 Whether verified by admin
  @Prop({ type: Boolean, default: false })
  isVerify?: boolean;

  // 🕒 Update approval flow
  @Prop({ type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' })
  updateStatus?: 'none' | 'pending' | 'approved' | 'rejected';

  // 🕐 Pending changes requested by vendor
  @Prop({
    type: Object,
    default: null,
    _id: false,
  })
  pendingChanges?: {
    name?: string;
    tiers?: Array<{
      price: number;
      name: string;
      duration?: string;
      description: string;
      guest?: string;
      features: string[];
    }>;

    // City info
    city?: Array<{
      name: string;
      maxBookingsPerDay: number;
    }>;
    tags?: string;
    description?: string;
    category?: Types.ObjectId;
    price?: number;
    maxBookingsPerDay?: number;
    duration?: string;
    banner?: string[];
    popular?: boolean;
    isActive?: boolean;
    maxQuantity?: number;
    isAvailableForBooking?: boolean;
    updatedAt?: Date;
    updatedBy?: Types.ObjectId;
  };


  @Prop({ type: String, required: false })
  updateReason?: string;
}

export const AddOnSchema = SchemaFactory.createForClass(AddOn);

// ✅ Plugins (Global Transform & Pagination)
AddOnSchema.plugin(mongooseGlobalTransformPlugin);
AddOnSchema.plugin(aggregatePaginate);
AddOnSchema.plugin(paginate);

// ✅ Indexes for better query performance
AddOnSchema.index({ createdBy: 1 });
AddOnSchema.index({ name: 1, cityOfOperation: 1 });
AddOnSchema.index({ category: 1 });
AddOnSchema.index({ isActive: 1, isAvailableForBooking: 1 });
