import { uploadImageToS3 } from './s3-upload.util';

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

export function safeParse(val: any): any {
  if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}

export function parseExistingImages(raw: any): string[] {
  if (!raw) return [];
  if (typeof raw === 'string' && raw.startsWith('[')) return JSON.parse(raw);
  if (Array.isArray(raw)) return raw;
  return [raw];
}