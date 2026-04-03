import { uploadImageToS3, deleteImageFromS3, extractS3KeyFromUrl } from './s3-upload.util';

// Fields exposed to public users — internal/audit fields are excluded
export const USER_SELECT =
  'name type city address description mapUrl isActive ' +
  'capacityMin capacityMax startingRentalPrice roomCount roomPrice ' +
  'yearStarted allowsSmallParties destinationPackagePrice ' +
  'destinationPackageDescription pricingTiers areas policies ' +
  'images contactPhone contactEmail amenities';

export async function uploadVenueImages(
  files: Array<Express.Multer.File>,
  keyPrefix: string,
): Promise<string[]> {
  return Promise.all(
    (files || []).map((file, index) =>
      uploadImageToS3({
        fileBuffer: file.buffer,
        key: `venues/${keyPrefix}-${Date.now()}-${index}`,
        contentType: file.mimetype,
      }),
    ),
  );
}

export async function uploadAreaImages(
  files: Array<Express.Multer.File>,
  areaIndex: number,
  keyPrefix: string,
): Promise<string[]> {
  const areaFiles = files.filter((f) => f.fieldname === `area_${areaIndex}_images`);
  return uploadVenueImages(areaFiles, `${keyPrefix}-area-${areaIndex}`);
}

/** Delete a list of S3 image URLs in parallel, silently skipping nulls. */
export async function bulkDeleteFromS3(urls: string[]): Promise<void> {
  await Promise.all(
    urls.map((url) => {
      const key = extractS3KeyFromUrl(url);
      if (!key) return Promise.resolve();
      return deleteImageFromS3({ key }).catch((err) =>
        console.error(`Failed to delete S3 key "${key}":`, err),
      );
    }),
  );
}

export function safeParse(val: any): any {
  if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}

export function parseExistingImages(raw: any): string[] {
  if (!raw) return [];
  if (typeof raw === 'string' && raw.startsWith('[')) return JSON.parse(raw);
  if (Array.isArray(raw)) return raw;
  return [raw];
}