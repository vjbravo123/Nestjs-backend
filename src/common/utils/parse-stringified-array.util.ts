import { TransformFnParams } from 'class-transformer';

export function parseStringifiedArray({ value }: TransformFnParams) {
    if (Array.isArray(value)) {
        // If the array contains a single string that looks like a stringified array, parse it
        if (value.length === 1 && typeof value[0] === 'string') {
            const v = value[0];
            // Try to parse as JSON array
            if (v.startsWith('[') && v.endsWith(']')) {
                try {
                    const parsed = JSON.parse(v);
                    if (Array.isArray(parsed)) return parsed;
                } catch {
                    // If not valid JSON, try to split manually
                    const stripped = v.slice(1, -1);
                    const arr = stripped.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                    return arr.filter(Boolean);
                }
            }
        }
        return value;
    }
    if (typeof value === 'string') {
        if (value.startsWith('[') && value.endsWith(']')) {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) return parsed;
            } catch {
                // If not valid JSON, try to split manually
                const stripped = value.slice(1, -1);
                const arr = stripped.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                return arr.filter(Boolean);
            }
        }
        return [value];
    }
    return value;
}