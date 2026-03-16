import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TalkToExpertController } from './talk-to-expert.controller';
import { TalkToExpertService } from './talk-to-expert.service';
import { TalkToExpert, TalkToExpertSchema } from './talk-to-expert.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: TalkToExpert.name, schema: TalkToExpertSchema }]),
  ],
  controllers: [TalkToExpertController],
  providers: [TalkToExpertService],
})
export class TalkToExpertModule {}