import { Controller, Get, Post, Body, UsePipes, ValidationPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { SubBusinessTypeService } from './subBusinesstype.service';
import { CreateSubBusinessTypeDto } from './dto/create-subBusinesstype.dto';

@Controller('sub-business-type')
export class SubBusinessTypeController {
  constructor(private readonly subBusinessTypeService: SubBusinessTypeService) { }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async create(@Body() dto: CreateSubBusinessTypeDto) {
    const created = await this.subBusinessTypeService.create(dto);
    return { message: 'Created', data: created };
  }

  @Get()
  async findAll() {
    const items = await this.subBusinessTypeService.findAll();
    return { message: 'OK', data: items };
  }
}


