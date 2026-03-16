import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { paginate } from 'src/common/utils/paginate.plugin';
import { mongooseGlobalTransformPlugin } from 'src/common/utils/mongoose-global-transform.plugin'
@Schema({ timestamps: true })
export class ContactUs extends Document {

    @Prop({ required: true, trim: true })
    fullName: string;

    @Prop({ required: true, lowercase: true, trim: true, index: true })
    email: string;

    @Prop({ required: true, trim: true, index: true })
    mobile: string;

    @Prop({ required: true, trim: true, index: true })
    city: string;

    @Prop({ required: true, trim: true })
    message: string;
}

export const ContactUsSchema = SchemaFactory.createForClass(ContactUs);


ContactUsSchema.plugin(paginate)
ContactUsSchema.plugin(mongooseGlobalTransformPlugin)
