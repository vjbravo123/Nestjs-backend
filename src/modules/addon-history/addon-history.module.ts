import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AddOnHistory, AddOnHistorySchema } from './addon-history.schema';
import { AddOnHistoryService } from './addon-history.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AddOnHistory.name, schema: AddOnHistorySchema },
    ]),
  ],
  providers: [AddOnHistoryService],
  exports: [AddOnHistoryService],
})
export class AddOnHistoryModule { }
