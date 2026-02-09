import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Model } from 'mongoose';
import { mongooseGlobalTransformPlugin } from '../../common/utils/mongoose-global-transform.plugin';
import { paginate } from '../../common/utils/paginate.plugin';

@Schema({ timestamps: true })
export class DropdownOption {
    @Prop({ required: true, enum: ['ageGroup', 'businessType', 'role', 'priceRange', 'experientialEventCategory'] })
    type: string;

    @Prop({ required: true, unique: true })
    value: string;

    @Prop()
    label?: string;

    @Prop({ type: MongooseSchema.Types.Mixed })
    extra?: Record<string, any>;
}

export type DropdownOptionDocument = DropdownOption & Document;

// ---- Add your custom model interface here ----
export interface DropdownOptionModel extends Model<DropdownOptionDocument> {
    checkDuplicate(value: string, excludeId?: string): Promise<boolean>;
}

// ---- Create schema ----
export const DropdownOptionSchema = SchemaFactory.createForClass(DropdownOption);

DropdownOptionSchema.plugin(mongooseGlobalTransformPlugin);
DropdownOptionSchema.plugin(paginate);
DropdownOptionSchema.index({ value: 1 }, { unique: true });

// ---- Add static method ----
DropdownOptionSchema.statics.checkDuplicate = async function (value: string, excludeId?: string) {
    const doc = await this.findOne({ value, _id: { $ne: excludeId } });
    return !!doc;
};
