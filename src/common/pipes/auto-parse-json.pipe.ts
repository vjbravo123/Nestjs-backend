import { Injectable, PipeTransform, ArgumentMetadata } from '@nestjs/common';

function tryParseJSON(value: any): any {
    if (typeof value !== 'string') return value;
    try {
        const parsed = JSON.parse(value);
        // Only return if parsed is object or array
        if (typeof parsed === 'object' && parsed !== null) {
            return parsed;
        }
    } catch { }
    // Try to parse as array of IDs: '[id1,id2]'
    if (/^\[.*\]$/.test(value)) {
        // Remove brackets and split by comma
        const arr = value.slice(1, -1).split(',').map(v => v.trim()).filter(Boolean);
        // If all elements look like Mongo IDs, treat as array
        if (arr.length && arr.every(v => /^[a-fA-F0-9]{24}$/.test(v))) {
            return arr;
        }
    }
    return value;
}

function deepParse(obj: any): any {
    if (Array.isArray(obj)) {
        return obj.map(deepParse);
    } else if (obj && typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
            obj[key] = deepParse(tryParseJSON(obj[key]));
        }
        return obj;
    }
    return tryParseJSON(obj);
}

@Injectable()
export class AutoParseJsonPipe implements PipeTransform {
    transform(value: any, metadata: ArgumentMetadata) {
        if (metadata.type === 'body' && value && typeof value === 'object') {
            return deepParse(value);
        }
        return value;
    }
}