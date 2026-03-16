import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import sharp = require('sharp');

export interface S3UploadParams {
  fileBuffer: Buffer;
  key: string;
  contentType?: string;
  bucket?: string;
}

const CONVERTIBLE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

/**
 * Compress and convert an image buffer to WebP.
 * SVGs and non-image types are returned unchanged.
 */
async function toWebP(
  buffer: Buffer,
  contentType: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  if (!CONVERTIBLE_TYPES.has(contentType)) {
    return { buffer, contentType };
  }
  const compressed = await sharp(buffer).webp({ quality: 80 }).toBuffer();
  return { buffer: compressed, contentType: 'image/webp' };
}

/**
 * Replace or append a .webp extension to the S3 key.
 */
function toWebPKey(key: string): string {
  return key.replace(/\.(jpe?g|png|webp)$/i, '') + '.webp';
}

/**
 * Upload an image to AWS S3 with automatic WebP compression.
 * JPEG and PNG files are converted to WebP (80% quality) before upload.
 * SVG and other formats are uploaded as-is.
 */
export async function uploadImageToS3({
  fileBuffer,
  key,
  contentType = 'image/jpeg',
  bucket,
}: S3UploadParams): Promise<string> {
  const s3Bucket = bucket || process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!s3Bucket || !region || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing AWS S3 configuration in environment variables');
  }

  // Step 1: Convert to WebP if applicable
  const { buffer: finalBuffer, contentType: finalContentType } = await toWebP(
    fileBuffer,
    contentType,
  );

  // Step 2: Update key extension for converted images
  const rawKey = finalContentType === 'image/webp' ? toWebPKey(key) : key;

  // Step 3: Sanitize key (replace unsafe characters)
  const sanitizedKey = rawKey.trim().replace(/[^\w.\-\/]/g, '_');

  // Step 4: URL-encode final key for browser-safe URLs
  const encodedKey = encodeURIComponent(sanitizedKey).replace(/%2F/g, '/');

  const s3 = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  const command = new PutObjectCommand({
    Bucket: s3Bucket,
    Key: sanitizedKey,
    Body: finalBuffer,
    ContentType: finalContentType,
  });

  await s3.send(command);

  return `https://${s3Bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
}

/**
 * Delete an image from AWS S3.
 */
export async function deleteImageFromS3({
  key,
  bucket,
}: {
  key: string;
  bucket?: string;
}): Promise<void> {
  const s3Bucket = bucket || process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!s3Bucket || !region || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing AWS S3 configuration in environment variables');
  }

  console.log(
    'key and bucket to be deleted inside function is ',
    key,
    s3Bucket,
  );

  const s3 = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  const command = new DeleteObjectCommand({
    Bucket: s3Bucket,
    Key: key,
  });

  await s3.send(command);
  console.log(`Deleted ${key} from S3 bucket ${s3Bucket}`);
}

export function extractS3KeyFromUrl(url: string): string | null {
  try {
    const match = url.match(/amazonaws\.com\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}
