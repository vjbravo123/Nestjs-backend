import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export interface S3UploadParams {
    fileBuffer: Buffer;
    key: string;
    contentType?: string;
    bucket?: string;
}

/**
 * Upload an image to AWS S3 with safe, sanitized, and browser-accessible key names.
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

    // ✅ Step 1: Sanitize key (replace unsafe characters)
    const sanitizedKey = key.trim().replace(/[^\w.\-\/]/g, '_'); // replaces spaces, +, #, etc.

    // ✅ Step 2: URL-encode final key for browser-safe URLs
    const encodedKey = encodeURIComponent(sanitizedKey).replace(/%2F/g, '/'); // preserve folder structure

    const s3 = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
    });

    const command = new PutObjectCommand({
        Bucket: s3Bucket,
        Key: sanitizedKey, // upload with safe key
        Body: fileBuffer,
        ContentType: contentType,
    });

    await s3.send(command);

    // ✅ Step 3: Return browser-accessible URL
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


    console.log("key and bucket to be deleted inside function is ", key, s3Bucket);

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