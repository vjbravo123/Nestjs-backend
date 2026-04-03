import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { Venue, VenueModel } from './venue.schema';
import { CreateVenueDto } from './create-venue.dto';
import { VenueQueryDto } from './venue-query.dto';
import { uploadImageToS3, deleteImageFromS3, extractS3KeyFromUrl } from '../../common/utils/s3-upload.util';

const USER_SELECT =
  'name type city address description mapUrl isActive ' +
  'capacityMin capacityMax startingRentalPrice roomCount roomPrice ' +
  'yearStarted allowsSmallParties destinationPackagePrice ' +
  'destinationPackageDescription pricingTiers areas policies ' +
  'images contactPhone contactEmail amenities';

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

    const imageUrls = await Promise.all(
      files
        .filter((f) => f.fieldname === 'images')
        .map((file, index) =>
          uploadImageToS3({
            fileBuffer: file.buffer,
            key: `venues/${keyPrefix}-${Date.now()}-${index}`,
            contentType: file.mimetype,
          }),
        ),
    );

    const rawAreas: any[] = this.safeParse(createVenueDto.areas as any) ?? [];
    const processedAreas = await Promise.all(
      rawAreas.map(async (area, index) => {
        const areaImageUrls = await Promise.all(
          files
            .filter((f) => f.fieldname === `area_${index}_images`)
            .map((file, i) =>
              uploadImageToS3({
                fileBuffer: file.buffer,
                key: `venues/${keyPrefix}-area-${index}-${Date.now()}-${i}`,
                contentType: file.mimetype,
              }),
            ),
        );
        return { ...area, images: areaImageUrls };
      }),
    );

    return new this.venueModel({
      ...createVenueDto,
      images: imageUrls,
      areas: processedAreas,
      pricingTiers: this.safeParse((createVenueDto as any).pricingTiers),
      policies: this.safeParse((createVenueDto as any).policies),
      amenities: this.safeParse((createVenueDto as any).amenities),
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
    const newVenueImageUrls = await Promise.all(
      files
        .filter((f) => f.fieldname === 'images')
        .map((file, index) =>
          uploadImageToS3({
            fileBuffer: file.buffer,
            key: `venues/update-${id}-${Date.now()}-${index}`,
            contentType: file.mimetype,
          }),
        ),
    );

    const keptVenueImages = this.parseExistingImages(updateVenueDto.existingImages);

    await Promise.all(
      (existingVenue.images ?? [])
        .filter((url) => !keptVenueImages.includes(url))
        .map((url) => {
          const key = extractS3KeyFromUrl(url);
          if (!key) return Promise.resolve();
          return deleteImageFromS3({ key }).catch((err) =>
            console.error(`Failed to delete S3 key "${key}":`, err),
          );
        }),
    );

    // ── Per-area images ──────────────────────────────────────────────────────
    const parsedAreas: any[] = this.safeParse(updateVenueDto.areas) ?? [];
    const existingAreas: any[] = (existingVenue.areas as any[]) ?? [];

    const processedAreas = await Promise.all(
      parsedAreas.map(async (area, index) => {
        const keptAreaImages = this.parseExistingImages(updateVenueDto[`existingAreaImages_${index}`]);

        const newAreaImageUrls = await Promise.all(
          files
            .filter((f) => f.fieldname === `area_${index}_images`)
            .map((file, i) =>
              uploadImageToS3({
                fileBuffer: file.buffer,
                key: `venues/${id}-area-${index}-${Date.now()}-${i}`,
                contentType: file.mimetype,
              }),
            ),
        );

        await Promise.all(
          (existingAreas[index]?.images ?? [])
            .filter((url) => !keptAreaImages.includes(url))
            .map((url) => {
              const key = extractS3KeyFromUrl(url);
              if (!key) return Promise.resolve();
              return deleteImageFromS3({ key }).catch((err) =>
                console.error(`Failed to delete S3 key "${key}":`, err),
              );
            }),
        );

        return { ...area, images: [...keptAreaImages, ...newAreaImageUrls] };
      }),
    );

    // ── Build final payload ───────────────────────────────────────────────────
    const formattedData: any = {
      ...updateVenueDto,
      images: [...keptVenueImages, ...newVenueImageUrls],
      areas: processedAreas,
      pricingTiers: this.safeParse(updateVenueDto.pricingTiers),
      policies: this.safeParse(updateVenueDto.policies),
      amenities: this.safeParse(updateVenueDto.amenities),
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

  // ─── Private Helpers─────────────────────────

  private safeParse(val: any): any {
    if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
      try { return JSON.parse(val); } catch { return val; }
    }
    return val;
  }

  private parseExistingImages(raw: any): string[] {
    if (!raw) return [];
    if (typeof raw === 'string' && raw.startsWith('[')) return JSON.parse(raw);
    if (Array.isArray(raw)) return raw;
    return [raw];
  }
}