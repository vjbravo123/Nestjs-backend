import { Body, Controller, Get, Param, Post, NotFoundException } from '@nestjs/common';
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

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const request = await this.talkToExpertService.findOne(id);
    if (!request) {
      throw new NotFoundException('Expert request not found');
    }
    return request;
  }
}