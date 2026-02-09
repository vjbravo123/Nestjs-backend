import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFiles,
  Req,
  BadRequestException,
  Query
} from '@nestjs/common';
import { ThemeService } from './theme.service';
import { CreateThemeDto } from './dto/create-theme.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { uploadImageToS3 } from '../../common/utils/s3-upload.util';
import pick from '../../common/utils/pick.util';

@Controller('themes')
export class ThemeController {
  constructor(private readonly themeService: ThemeService) { }

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'themeImage', maxCount: 1 },
      { name: 'icon', maxCount: 1 },
    ]),
  )
  async create(
    @Body() createThemeDto: CreateThemeDto,
    @UploadedFiles()
    files: { themeImage?: any[]; icon?: any[] }, // 
  ) {
    if (!files.themeImage || !files.themeImage[0]) {
      throw new BadRequestException('Theme image is required');
    }

    const themeImageFile = files.themeImage[0];
    const iconFile = files.icon?.[0];

    const themeImageUrl = await uploadImageToS3({
      fileBuffer: themeImageFile.buffer,
      key: `themes/${createThemeDto.name}-${Date.now()}-${themeImageFile.originalname}`,
      contentType: themeImageFile.mimetype,
    });

    if (!themeImageUrl) {
      throw new BadRequestException('Failed to upload theme image to S3');
    }

    createThemeDto.themeImage = themeImageUrl;

    if (iconFile) {
      const iconUrl = await uploadImageToS3({
        fileBuffer: iconFile.buffer,
        key: `themes/icons/${createThemeDto.name}-${Date.now()}-${iconFile.originalname}`,
        contentType: iconFile.mimetype,
      });

      if (!iconUrl) {
        throw new BadRequestException('Failed to upload icon image to S3');
      }

      createThemeDto.icon = iconUrl;
    }

    return this.themeService.create(createThemeDto);
  }


  @Get()
  async findAll(@Query() query: any) {
    const filters = pick(query, ['name', 'status', 'tag', 'eventType']);
    const options = pick(query, ['page', 'limit', 'sortBy', 'populate']);
    return this.themeService.findAll({ ...filters, ...options });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.themeService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateThemeDto: UpdateThemeDto) {
    return this.themeService.update(id, updateThemeDto);
  }

  @Patch(':id/active')
  async setActive(@Param('id') id: string, @Body('active') active: boolean) {
    return this.themeService.update(id, { active });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.themeService.remove(id);
  }
}
