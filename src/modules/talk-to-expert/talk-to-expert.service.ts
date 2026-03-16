import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { TalkToExpert } from './talk-to-expert.schema';
import { CreateTalkToExpertDto } from './dto/create-talk-to-expert.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
@Injectable()
export class TalkToExpertService {
  private readonly logger = new Logger(TalkToExpertService.name);

  constructor(
    @InjectModel(TalkToExpert.name)

    private readonly talkToExpertModel: Model<TalkToExpert>,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  // ----------------------------------
  // 📩 CREATE REQUEST
  // ----------------------------------
  async create(dto: CreateTalkToExpertDto): Promise<TalkToExpert> {
    try {
      console.log("dto on request ", dto);

      const payload = {
        eventCategory: dto.eventCategory,
        eventId: dto.eventId,
        name: dto.name.trim(),
        phone: dto.phone,
        contactMethod: dto.contactMethod,
        preferredTime: dto.preferredTime.trim(),
        status: 'PENDING',
      };

      const created = await this.talkToExpertModel.create(payload);

      /**
       * 🔔 Emit event
       */
      this.eventEmitter.emit('talktoexpert.created', {
        requestId: created._id.toString(),
        name: created.name,
        phone: created.phone,
        contactMethod: created.contactMethod,
        preferredTime: created.preferredTime,
        eventName: created.eventCategory,
        createdAt: new Date().toISOString(),
      });

      return created;

    } catch (error) {
      console.error('REAL ERROR →', error);
      throw error;
    }
  }


  // ----------------------------------
  // 📋 GET ALL REQUESTS
  // ----------------------------------
  async findAll(
    page = 1,
    limit = 20,
  ): Promise<TalkToExpert[]> {
    try {
      const skip = (page - 1) * limit;

      return await this.talkToExpertModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<TalkToExpert[]>()
        .exec();
    } catch (error) {
      this.logger.error(
        'Failed to fetch TalkToExpert requests',
        error.stack,
      );
      throw new InternalServerErrorException(
        'Unable to fetch requests',
      );
    }
  }
}
