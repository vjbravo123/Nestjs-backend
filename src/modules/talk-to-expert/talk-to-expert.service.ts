import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TalkToExpert } from './talk-to-expert.schema';
import { CreateTalkToExpertDto } from './dto/create-talk-to-expert.dto';

@Injectable()
export class TalkToExpertService {
  constructor(
    @InjectModel(TalkToExpert.name) private talkToExpertModel: Model<TalkToExpert>,
  ) {}

  async create(createDto: CreateTalkToExpertDto): Promise<TalkToExpert> {
    const createdRequest = new this.talkToExpertModel(createDto);
    return createdRequest.save();
  }

  async findAll(): Promise<TalkToExpert[]> {
    return this.talkToExpertModel.find().exec();
  }
}