import { BadRequestException } from '@nestjs/common';
import { IMAGE_MIME_TYPES, VIDEO_MIME_TYPES } from '../constants/mime-types.constant';

export function validateMediaFile(existingType: string, fileMime: string) {
    console.log("fileName is a ", fileMime);
    if (existingType === 'image' && !IMAGE_MIME_TYPES.includes(fileMime)) {
        throw new BadRequestException('Invalid file type. Only image files are allowed.');
    }
    console.log("existingType is a ", VIDEO_MIME_TYPES);
    if (existingType === 'video' && !VIDEO_MIME_TYPES.includes(fileMime)) {
        throw new BadRequestException('Invalid file type. Only video files are allowed.');
    }
}

export function validateIconFile(mime: string) {
    if (!IMAGE_MIME_TYPES.includes(mime)) {
        throw new BadRequestException('Icon must be an IMAGE.');
    }
}
