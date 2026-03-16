import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
@Schema({ timestamps: true })
export class SubExperientialEventCategory {
    @Prop({ required: true, unique: true })
    name: string;


    @Prop({ type: Types.ObjectId, ref: "DropdownOption", required: true })
    experientialEventCategoryId: Types.ObjectId;

    @Prop()
    description?: string;

    @Prop({ default: true })
    isActive?: boolean;
    @Prop({ default: false })
    isDeleted?: boolean;
}

export type SubExperientialEventCategoryDocument = HydratedDocument<SubExperientialEventCategory>;
export const SubExperientialEventCategorySchema = SchemaFactory.createForClass(SubExperientialEventCategory);