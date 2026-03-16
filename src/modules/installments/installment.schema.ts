import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { mongooseGlobalTransformPlugin } from 'src/common/utils/mongoose-global-transform.plugin';
import { paginate } from 'src/common/utils/paginate.plugin';

export type InstallmentScheduleDocument = HydratedDocument<InstallmentSchedule>;

@Schema()
class Installment {

  @Prop({ required: true })
  installmentNumber: number;

  @Prop({ required: true })
  percentage: number;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  dueDate: Date;

  @Prop({
    enum: ['pending', 'paid'],
    default: 'pending'
  })
  status: string;

  @Prop()
  paidAt?: Date;

  @Prop()
  transactionId?: string;
}

const InstallmentSchema = SchemaFactory.createForClass(Installment);

@Schema({ timestamps: true })
export class InstallmentSchedule {

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  checkoutBatchId: string;

  @Prop({ required: true })
  totalAmount: number;

  @Prop({ required: true })
  paidAmount: number;

  @Prop({ type: [InstallmentSchema], default: [] })
  installments: Installment[];
}

export const InstallmentScheduleSchema =
  SchemaFactory.createForClass(InstallmentSchedule);
InstallmentScheduleSchema.plugin(paginate)
InstallmentScheduleSchema.plugin(mongooseGlobalTransformPlugin)