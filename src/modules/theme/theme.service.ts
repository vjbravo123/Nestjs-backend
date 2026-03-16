import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Theme, ThemeDocument } from './theme.schema';
import { CreateThemeDto } from './dto/create-theme.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';

@Injectable()
export class ThemeService {
  constructor(
    @InjectModel(Theme.name) private themeModel: Model<ThemeDocument>,
  ) { }

  async create(createThemeDto: CreateThemeDto): Promise<Theme> {
    const createdTheme = new this.themeModel(createThemeDto);
    return createdTheme.save();
  }

  async findAll(options: any = {}) {
    const {
      page = 1,
      limit = 10,
      sortBy,
      populate,
      ...filter
    } = options;
    return (this.themeModel as any).paginate(filter, {
      page: Number(page),
      limit: Number(limit),
      sortBy,
      populate,
    });
  }

  async findOne(id: string): Promise<Theme> {
    const theme = await this.themeModel.findById(id).exec();
    if (!theme) throw new NotFoundException('Theme not found');
    return theme;
  }

  async update(id: string, updateThemeDto: UpdateThemeDto): Promise<Theme> {
    const theme = await this.themeModel.findByIdAndUpdate(id, updateThemeDto, { new: true }).exec();
    if (!theme) throw new NotFoundException('Theme not found');
    return theme;
  }

  async remove(id: string): Promise<Theme> {
    const theme = await this.themeModel.findByIdAndDelete(id).exec();
    if (!theme) throw new NotFoundException('Theme not found');
    return theme;
  }
}