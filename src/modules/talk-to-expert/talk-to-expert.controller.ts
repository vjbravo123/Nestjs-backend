import { Body, Controller, Get, Post } from '@nestjs/common';
import { TalkToExpertService } from './talk-to-expert.service';
import { CreateTalkToExpertDto } from './dto/create-talk-to-expert.dto';

@Controller('talk-to-expert')
export class TalkToExpertController {
  constructor(private readonly talkToExpertService: TalkToExpertService) {}

  @Post()
  async create(@Body() createDto: CreateTalkToExpertDto) {
    return this.talkToExpertService.create(createDto);
  }

  @Get()
  async findAll() {
    return this.talkToExpertService.findAll();
  }
}