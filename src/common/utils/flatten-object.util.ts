import { Types } from 'mongoose';

/**
 * Recursively flattens an object into Mongoose-friendly dot notation.
 * Example: { gst: { userCharge: 10 } } becomes { "gst.userCharge": 10 }
 */
export function flattenObject(obj: any, prefix = ''): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const key in obj) {
        if (obj[key] === undefined) continue;

        const newKey = prefix ? `${prefix}.${key}` : key;
        
        // If it's a plain object (not an array, date, or ObjectId), recurse
        if (
            obj[key] !== null &&
            typeof obj[key] === 'object' &&
            !Array.isArray(obj[key]) &&
            !(obj[key] instanceof Date) &&
            !(obj[key] instanceof Types.ObjectId)
        ) {
            Object.assign(result, flattenObject(obj[key], newKey));
        } else {
            result[newKey] = obj[key];
        }
    }
    return result;
}