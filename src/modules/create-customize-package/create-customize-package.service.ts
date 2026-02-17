import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CustomizePackage } from './customize-package.schema';
import { CreateCustomizePackageDto } from './dto/create-customize-package.dto';

@Injectable()
export class CustomizePackageService {
  constructor(
    @InjectModel(CustomizePackage.name) private customizePackageModel: Model<CustomizePackage>,
  ) {}

  async create(createDto: CreateCustomizePackageDto): Promise<CustomizePackage> {
    const createdPackage = new this.customizePackageModel(createDto);
    return createdPackage.save();
  }

  async findAll(): Promise<CustomizePackage[]> {
    return this.customizePackageModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<CustomizePackage | null> {
    return this.customizePackageModel.findById(id).exec();
  }
}