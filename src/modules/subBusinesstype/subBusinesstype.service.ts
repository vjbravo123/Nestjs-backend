import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SubBusinessType, SubBusinessTypeDocument } from './subBusinesstype.schema';
import { CreateSubBusinessTypeDto } from './dto/create-subBusinesstype.dto';

@Injectable()
export class SubBusinessTypeService {
  constructor(
    @InjectModel(SubBusinessType.name)
    private readonly subBusinessTypeModel: Model<SubBusinessTypeDocument>,
  ) { }

  async create(dto: CreateSubBusinessTypeDto): Promise<SubBusinessTypeDocument> {
    const created = new this.subBusinessTypeModel({
      businessType: dto.businessType,
      name: dto.name,
    });
    return created.save();
  }

  async findAll(): Promise<SubBusinessTypeDocument[]> {
    return this.subBusinessTypeModel
      .find()
      .populate({
        path: 'businessType',
        select: 'name type value label',
      })
      .exec();

  }
}


