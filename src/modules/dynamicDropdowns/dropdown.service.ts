import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DropdownOption, DropdownOptionModel, DropdownOptionDocument } from './dropdown.schema';
import { CreateDropdownOptionDto } from './dto/create-dropdown-option.dto';

@Injectable()
export class DropdownService {
  constructor(
    @InjectModel(DropdownOption.name)
    private readonly dropdownModel: DropdownOptionModel
  ) { }

  async createOption(dto: CreateDropdownOptionDto) {

    const created = new this.dropdownModel(dto);
    return await created.save();

  }

  async getOptions(options: any = {}) {
    const { sortBy, populate, ...filter } = options;

    // Handle array filter for `types`
    if (filter.types) {
      try {
        const typesArray = Array.isArray(filter.types)
          ? filter.types
          : JSON.parse(filter.types);
        filter.type = { $in: typesArray };
        delete filter.types;
      } catch (e) {
        // ignore parse error, fallback to single type
      }
    }

    const pipeline: any[] = [];

    // Apply filters
    if (Object.keys(filter).length > 0) {
      pipeline.push({ $match: filter });
    }

    // Group by type
    pipeline.push({
      $group: {
        _id: "$type",
        results: { $push: "$$ROOT" },
      },
    });

    // Optional sorting inside groups
    if (sortBy) {
      pipeline.push({ $sort: { [sortBy]: 1 } });
    }

    const result = await this.dropdownModel.aggregate(pipeline);

    // 🔑 Convert array to keyed object
    const dropdownOptions = result.reduce((acc, group) => {
      acc[group._id] = group.results;
      return acc;
    }, {} as Record<string, any[]>);

    return dropdownOptions
  }



  async updateOption(id: string, updateBody: Partial<CreateDropdownOptionDto>) {
    // 1. Fetch the document
    const option = await this.dropdownModel.findById(id);
    if (!option) {
      throw new NotFoundException('Dropdown option not found');
    }
    console.log("updates body", updateBody)
    // 2. Check for duplicates (skip the current document)
    if (updateBody.value && (await this.dropdownModel.checkDuplicate(updateBody.value, id))) {
      throw new ConflictException('Value already exists.');
    }

    // 3. Assign new values
    Object.assign(option, updateBody);

    // 4. Save the document
    await option.save();

    return option;
  }
  async deleteOption(id: string) {
    const option = await this.dropdownModel.findById(id);
    if (!option) {
      throw new NotFoundException('Dropdown option not found');
    }

    await option.deleteOne(); // or option.deleteOne()
    return option; // return the deleted document
  }
}