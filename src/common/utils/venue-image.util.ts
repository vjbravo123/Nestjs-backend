import { uploadImageToS3 } from './s3-upload.util';

/**
 * Uploads an array of Multer files to S3 under the given key prefix.
 * Falls back to a random picsum URL if the S3 upload fails.
 */
export async function uploadVenueImages(
  files: Array<Express.Multer.File>,
  keyPrefix: string,
): Promise<string[]> {
  return Promise.all(
    (files || []).map(async (file, index) => {
      try {
        return await uploadImageToS3({
          fileBuffer: file.buffer,
          key: `venues/${keyPrefix}-${Date.now()}-${index}`,
          contentType: file.mimetype,
        });
      } catch (error) {
        console.error('S3 upload failed, using fallback:', error.message);
        return `https://picsum.photos/seed/${Math.floor(Math.random() * 100000)}/800/600`;
      }
    }),
  );
}

/**
 * Safely parses a value that may arrive from multipart form-data as a
 * JSON string. Returns the value as-is if it is not a JSON string.
 */
export function safeParse(val: any): any {
  if (
    typeof val === 'string' &&
    (val.startsWith('[') || val.startsWith('{'))
  ) {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}

/**
 * Normalises the existingImages field which can arrive from form-data
 * as a JSON array string, a plain array, or a single string URL.
 */
export function parseExistingImages(raw: any): string[] {
  if (!raw) return [];
  if (typeof raw === 'string' && raw.startsWith('[')) return JSON.parse(raw);
  if (Array.isArray(raw)) return raw;
  return [raw];
}