import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubBusinessType, SubBusinessTypeSchema } from './subBusinesstype.schema';
import { SubBusinessTypeService } from './subBusinesstype.service';
import { SubBusinessTypeController } from './subBusinesstype.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SubBusinessType.name, schema: SubBusinessTypeSchema },
    ]),
  ],
  controllers: [SubBusinessTypeController],
  providers: [SubBusinessTypeService],
  exports: [SubBusinessTypeService],
})
export class SubBusinessTypeModule { }


