import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventDetail, EventDetailSchema } from './eventdetail.schema';
import { EventDetailController } from './eventdetail.controller';
import { EventDetailService } from './eventdetail.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: EventDetail.name, schema: EventDetailSchema }])],
  controllers: [EventDetailController],
  providers: [EventDetailService],
})
export class EventDetailModule {}