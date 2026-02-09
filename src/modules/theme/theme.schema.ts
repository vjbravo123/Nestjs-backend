import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { required } from 'joi';
import { Document } from 'mongoose';
import { mongooseGlobalTransformPlugin } from '../../common/utils/mongoose-global-transform.plugin'
import { paginate } from '../../common/utils/paginate.plugin';
export type ThemeDocument = Theme & Document;

@Schema({ timestamps: true })
export class Theme {
    @Prop({ required: true, unique: true })
    name: string;

    @Prop({ required: true })
    description: string;

    @Prop()
    icon: string; // URL or icon name

    @Prop({ enum: ['curated', 'birthDay'] })
    eventType: string;

    @Prop({ default: true })
    active: boolean;

    @Prop({ default: 0 })
    eventCount: number;


    @Prop()
    themeImage: string;
}

export const ThemeSchema = SchemaFactory.createForClass(Theme);

ThemeSchema.plugin(mongooseGlobalTransformPlugin);
ThemeSchema.plugin(paginate);
