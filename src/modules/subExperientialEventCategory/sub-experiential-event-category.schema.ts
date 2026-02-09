import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Types } from 'mongoose';
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
    @Prop({ default: true })
    isDeleted?: boolean;
}

export type SubExperientialEventCategoryDocument = SubExperientialEventCategory & Document;
export const SubExperientialEventCategorySchema = SchemaFactory.createForClass(SubExperientialEventCategory);