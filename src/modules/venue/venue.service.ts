import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { Venue, VenueModel } from './venue.schema';
import { CreateVenueDto } from './create-venue.dto';
import { VenueQueryDto } from './venue-query.dto';
import {
  USER_SELECT,
  uploadVenueImages,
  uploadAreaImages,
  bulkDeleteFromS3,
  safeParse,
  parseExistingImages,
} from '../../common/utils/venue-image.util';

@Injectable()
export class VenueService {
  constructor(
    @InjectModel(Venue.name) private venueModel: VenueModel,
  ) {}

  // ─── create ─────────────────────────────────────────────────────────────────

  async create(createVenueDto: CreateVenueDto, files: Array<Express.Multer.File>): Promise<Venue> {
    if (createVenueDto.capacityMax < createVenueDto.capacityMin)
      throw new BadRequestException('Max capacity cannot be less than Min capacity');

    const keyPrefix = createVenueDto.name.replace(/\s+/g, '-');
    const imageUrls = await uploadVenueImages(files.filter((f) => f.fieldname === 'images'), keyPrefix);

    const rawAreas: any[] = safeParse(createVenueDto.areas as any) ?? [];
    const processedAreas = await Promise.all(
      rawAreas.map(async (area, index) => ({
        ...area,
        images: await uploadAreaImages(files, index, keyPrefix),
      })),
    );

    return new this.venueModel({
      ...createVenueDto,
      images: imageUrls,
      areas: processedAreas,
      pricingTiers: safeParse((createVenueDto as any).pricingTiers),
      policies: safeParse((createVenueDto as any).policies),
      amenities: safeParse((createVenueDto as any).amenities),
    }).save();
  }

  // ─── findAll ─────────────────────────────────────────────────────────────────

  async findAll(query: VenueQueryDto, isAdmin: boolean): Promise<any> {
    const { page, limit, search, type, city, minGuests, maxBudget, sortBy } = query;

    const filter: Record<string, any> = { isDeleted: false };

    if (type && type !== 'all') filter.type = type;
    if (city && city !== 'all') filter.city = new RegExp(city, 'i');
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [{ name: regex }, { city: regex }, { address: regex }];
    }
    if (minGuests) filter.capacityMax = { $gte: minGuests };
    if (maxBudget) filter['pricingTiers.pricePerPlate'] = { $lte: maxBudget };

    let sortByOption = 'createdAt:desc';
    if (sortBy === 'price_low') sortByOption = 'pricingTiers[0].pricePerPlate:asc';
    if (sortBy === 'price_high') sortByOption = 'pricingTiers[0].pricePerPlate:desc';

    const options: Record<string, any> = { page, limit, sortBy: sortByOption };
    if (!isAdmin) options.select = USER_SELECT;

    return this.venueModel.paginate(filter, options);
  }

  // ─── findOne ─────────────────────────────────────────────────────────────────

  async findOne(id: Types.ObjectId, isAdmin: boolean): Promise<Venue> {
    let query = this.venueModel.findById(id).where({ isDeleted: false });
    if (!isAdmin) query = query.select(USER_SELECT);

    const venue = await query.exec();
    if (!venue) throw new NotFoundException('Venue not found');
    return venue;
  }

  // ─── update ──────────────────────────────────────────────────────────────────

  async update(id: Types.ObjectId, updateVenueDto: any, files: Array<Express.Multer.File>): Promise<Venue> {
    if (
      updateVenueDto.capacityMin !== undefined &&
      updateVenueDto.capacityMax !== undefined &&
      Number(updateVenueDto.capacityMax) < Number(updateVenueDto.capacityMin)
    ) throw new BadRequestException('Max capacity cannot be less than Min capacity');

    const existingVenue = await this.venueModel.findById(id).exec();
    if (!existingVenue) throw new NotFoundException('Venue not found');

    // ── Venue-level images ───────────────────────────────────────────────────
    const newVenueImageUrls = await uploadVenueImages(files.filter((f) => f.fieldname === 'images'), `update-${id}`);
    const keptVenueImages = parseExistingImages(updateVenueDto.existingImages);
    await bulkDeleteFromS3((existingVenue.images ?? []).filter((url) => !keptVenueImages.includes(url)));

    // ── Per-area images ──────────────────────────────────────────────────────
    const parsedAreas: any[] = safeParse(updateVenueDto.areas) ?? [];
    const existingAreas: any[] = (existingVenue.areas as any[]) ?? [];

    const processedAreas = await Promise.all(
      parsedAreas.map(async (area, index) => {
        const keptAreaImages = parseExistingImages(updateVenueDto[`existingAreaImages_${index}`]);
        const newAreaImageUrls = await uploadAreaImages(files, index, id.toString());
        await bulkDeleteFromS3((existingAreas[index]?.images ?? []).filter((url) => !keptAreaImages.includes(url)));
        return { ...area, images: [...keptAreaImages, ...newAreaImageUrls] };
      }),
    );

    // ── Build final payload ───────────────────────────────────────────────────
    const formattedData: any = {
      ...updateVenueDto,
      images: [...keptVenueImages, ...newVenueImageUrls],
      areas: processedAreas,
      pricingTiers: safeParse(updateVenueDto.pricingTiers),
      policies: safeParse(updateVenueDto.policies),
      amenities: safeParse(updateVenueDto.amenities),
    };

    delete formattedData.existingImages;
    Object.keys(formattedData)
      .filter((k) => k.startsWith('existingAreaImages_'))
      .forEach((k) => delete formattedData[k]);

    const updatedVenue = await this.venueModel
      .findByIdAndUpdate(id, { $set: formattedData }, { new: true, runValidators: true })
      .exec();

    if (!updatedVenue) throw new NotFoundException('Venue not found');
    return updatedVenue;
  }

  // ─── toggleActive ────────────────────────────────────────────────────────────

  async toggleActive(id: Types.ObjectId): Promise<Venue> {
    const venue = await this.venueModel.findById(id).exec();
    if (!venue) throw new NotFoundException('Venue not found');
    venue.isActive = !venue.isActive;
    return venue.save();
  }

  // ─── remove (soft delete) ────────────────────────────────────────────────────

  async remove(id: Types.ObjectId): Promise<{ message: string }> {
    const venue = await this.venueModel.findById(id).exec();
    if (!venue) throw new NotFoundException('Venue not found');
    venue.isDeleted = true;
    await venue.save();
    return { message: 'Venue deleted successfully' };
  }
}