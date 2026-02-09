import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Model } from 'mongoose';
import { mongooseGlobalTransformPlugin } from '../../common/utils/mongoose-global-transform.plugin'
import { paginate } from '../../common/utils/paginate.plugin';


@Schema({ timestamps: true })
export class BirthdayEvent {
    @Prop({ required: true })
    title: string;




    @Prop({ type: [{ type: Types.ObjectId, ref: 'Category' }], default: [] })
    addOns: Types.ObjectId[];


    @Prop({ required: true, enum: ['kids', 'teens', 'adult', 'milestone'] })
    ageGroup: string;

    // @Prop({ required: true, type: { min: Number, max: Number }, _id: false })
    // guests: { min: number; max: number };

    @Prop({ required: true })
    duration: number;

    @Prop()
    coreActivity: string[]

    @Prop({ default: true }) // or false depending on your default
    active?: boolean;
    // @Prop({ required: true })
    // price: number;

    @Prop({ type: [String], default: [] })
    banner?: string[];


    @Prop({ type: String, trim: true })
    exclusion?: string;

    @Prop()
    description?: string;

    @Prop({ default: false })
    isShowcaseEvent?: boolean;

    // @Prop({ type: [{ type: Types.ObjectId, ref: 'EventDetail' }], default: [] })
    // highlights: Types.ObjectId[];

    // @Prop({ type: [{ type: Types.ObjectId, ref: 'EventDetail' }], default: [] })
    // includes: Types.ObjectId[];

    // @Prop({ type: [{ type: Types.ObjectId, ref: 'EventDetail' }], default: [] })
    // policy: Types.ObjectId[];

    @Prop({
        type: [
            {
                price: { type: Number, required: true },
                name: { type: String, required: true },
                description: { type: String, required: true },
                guest: { type: String, required: true },
                features: { type: [String], required: true },

            }
        ],
        default: []
    })

    tiers: Array<{
        price: number;
        name: string;
        description: string;
        guest: string;
        features: string[];
    }>;
    @Prop({
        type: [
            {
                name: { type: String, required: true },
                maxBookingsPerDay: { type: Number, required: true },
                _id: false // 👈 disable auto _id
            }
        ],
        default: []
    })

    city: Array<{
        name: string;
        maxBookingsPerDay: number;
    }>;

    @Prop({ enum: ['Popular Among Boys', 'Popular Among Girls', 'All-time Classics'] })
    subCategory: string;

    @Prop()
    tags: string;

    @Prop({ type: Number, max: 100 })
    discount?: number | null;

    @Prop()
    image?: string;

    @Prop()
    totalBookings?: number;


    @Prop({ type: [String], default: undefined })
    delight?: string[];


}



export type BirthdayEventDocument = BirthdayEvent & Document;

export const BirthdayEventSchema = SchemaFactory.createForClass(BirthdayEvent);
BirthdayEventSchema.plugin(mongooseGlobalTransformPlugin);
BirthdayEventSchema.plugin(paginate);

