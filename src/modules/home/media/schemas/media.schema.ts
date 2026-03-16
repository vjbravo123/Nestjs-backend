import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { MediaType } from '../enums/media-type.enum';

@Schema({ timestamps: true })
export class Media extends Document {
    @Prop({ required: true, enum: MediaType })
    mediaType: MediaType;

    @Prop({ required: true })
    title: string;

    @Prop({ required: true })
    description: string;

    @Prop({ required: true })
    icon: string; // icon file path

    @Prop({ required: true })
    file: string; // image or video path
}

export const MediaSchema = SchemaFactory.createForClass(Media);
