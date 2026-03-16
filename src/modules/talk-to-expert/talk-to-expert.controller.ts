import {
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { TalkToExpertService } from './talk-to-expert.service';
import { CreateTalkToExpertDto } from './dto/create-talk-to-expert.dto';

@Controller('talk-to-expert')
export class TalkToExpertController {
  constructor(
    private readonly talkToExpertService: TalkToExpertService,
  ) { }

  // ----------------------------------
  // 📩 CREATE REQUEST
  // ----------------------------------
  @Post()
  async create(
    @Body() dto: CreateTalkToExpertDto,
  ) {
    return this.talkToExpertService.create(dto);
  }

  // ----------------------------------
  // 📋 GET ALL REQUESTS (ADMIN)
  // ----------------------------------
  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.talkToExpertService.findAll(
      Number(page) || 1,
      Number(limit) || 20,
    );
  }
}
