import { Body, Controller, Get, Post } from '@nestjs/common';
import { CustomizePackageService } from './create-customize-package.service';
import { CreateCustomizePackageDto } from './dto/create-customize-package.dto';

@Controller('customize-package')
export class CustomizePackageController {
  constructor(private readonly customizePackageService: CustomizePackageService) {}

  @Post()
  async create(@Body() createDto: CreateCustomizePackageDto) {
    return this.customizePackageService.create(createDto);
  }

  @Get()
  async findAll() {
    return this.customizePackageService.findAll();
  }
}