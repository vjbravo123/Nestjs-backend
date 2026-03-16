import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { mongooseGlobalTransformPlugin } from '../../common/utils/mongoose-global-transform.plugin';

export type AddOnHistoryDocument = HydratedDocument<AddOnHistory>;

@Schema({ timestamps: true, versionKey: false })
export class AddOnHistory {
    @Prop({ type: SchemaTypes.ObjectId, ref: 'AddOn', required: true })
    addOnId: Types.ObjectId;

    @Prop({ type: SchemaTypes.ObjectId, refPath: 'updatedByRole', required: true })
    updatedBy: Types.ObjectId;

    @Prop({ type: String, enum: ['admin', 'vendor'], required: true })
    updatedByRole: 'admin' | 'vendor';


    @Prop({ type: String, enum: ['approved', 'rejected', 'edit_by_admin'], required: true })
    updateStatus: 'approved' | 'rejected' | 'edit_by_admin';


    @Prop({
        type: Map,
        of: Object,
        required: true,
    })
    changes: Record<string, { oldValue: any; newValue: any }>;

    @Prop({ type: String, default: null })
    comment?: string;
}

export const AddOnHistorySchema = SchemaFactory.createForClass(AddOnHistory);
AddOnHistorySchema.plugin(mongooseGlobalTransformPlugin);

AddOnHistorySchema.index({ addOnId: 1 });
AddOnHistorySchema.index({ updatedBy: 1 });
AddOnHistorySchema.index({ createdAt: -1 });
