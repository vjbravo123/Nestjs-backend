import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, SchemaTypes } from 'mongoose';
import { mongooseGlobalTransformPlugin } from '../../common/utils/mongoose-global-transform.plugin';
import { paginate } from '../../common/utils/paginate.plugin';
import { aggregatePaginate } from '../../common/utils/aggregate-paginate.plugin';

@Schema({ timestamps: true })
export class ExperientialEvent {
    @Prop({ required: true })
    title: string;


    @Prop({ type: [{ type: Types.ObjectId, ref: 'Category' }], default: [] })
    addOns: Types.ObjectId[];

    @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true })
    createdBy: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'DropdownOption' })
    experientialEventCategory: Types.ObjectId;


    @Prop({ type: [{ type: Types.ObjectId, ref: 'SubExperientialEventCategory' }], default: undefined })
    subExperientialEventCategory: Types.ObjectId[];

    @Prop({})
    duration?: number;

    @Prop({ type: [String], default: undefined })
    coreActivity?: string[];

    @Prop({ default: false })
    isActive?: boolean;

    @Prop({ type: String, trim: true })
    exclusion?: string;


    @Prop({ type: [String], default: undefined })
    banner?: string[];

    @Prop()
    description?: string;

    @Prop()
    tags?: string;
    // for verification status at first time by admin
    @Prop({ default: false })
    isVerify?: boolean;


    @Prop({ type: Boolean, default: false })
    isBlocked: boolean;

    @Prop({})
    position: number;


    @Prop({
        type: [
            {
                price: { type: Number, required: true },
                name: { type: String, required: true },
                description: { type: String, required: true },
                guest: { type: String, required: true },
                features: { type: [String], required: true },
            },
        ],
        default: undefined,
    })
    tiers: Array<{
        price: number;
        name: string;
        description: string;
        guest: string;
        features: string[];
    }>;
    @Prop()
    discount?: number;

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
    city?: Array<{
        name: string;
        maxBookingsPerDay: number;
    }>;

    // --------------------------
    // Pending Changes (for approval workflow)
    // --------------------------
    @Prop({
        type: Object,
        default: null,
        _id: false,
    })
    pendingChanges?: {
        // Basic fields
        title?: string;
        description?: string;
        duration?: number;
        coreActivity?: string[];
        banner?: string[];
        tags?: string;

        // ObjectId references
        experientialEventCategory?: Types.ObjectId;
        subExperientialEventCategory?: Types.ObjectId[];

        discount?: number;
        delight?: string[]

        // Tiers
        tiers?: Array<{
            price: number;
            name: string;
            description: string;
            guest: string;
            features: string[];
        }>;

        // City info
        city?: Array<{
            name: string;
            maxBookingsPerDay: number;
        }>;

        // Verification / metadata
        isVerify?: boolean;

        // Approval tracking
        updatedAt?: Date;
        updatedBy?: string; // Vendor ID or Admin ID

        // Event update status & reason
        eventUpdateStatus?: 'none' | 'pending' | 'approved' | 'rejected';
        eventUpdateReason?: string;

        // Other numeric fields
        totalBookings?: number;
    };

    @Prop({
        enum: ['none', 'pending', 'approved', 'rejected'],
        default: 'none',
    })
    eventUpdateStatus?: string;



    @Prop({ default: false })
    isShowcaseEvent?: boolean;

    @Prop()
    eventUpdateReason?: string;

    @Prop({ default: 0 })
    totalBookings?: number;


    @Prop({ type: [String], default: undefined })
    delight?: string[];
}

export type ExperientialEventDocument = ExperientialEvent & Document;
export const ExperientialEventSchema = SchemaFactory.createForClass(ExperientialEvent);

// Plugins
ExperientialEventSchema.plugin(mongooseGlobalTransformPlugin);
ExperientialEventSchema.plugin(paginate);
ExperientialEventSchema.plugin(aggregatePaginate);
