import { Transform } from 'class-transformer';

export function ParseBoolean() {
    return Transform(({ value }) => {
        if (value === null || value === undefined) return undefined;

        if (typeof value === 'boolean') return value;

        if (typeof value === 'string') {
            const v = value.toLowerCase().trim();
            if (v === 'true' || v === '1') return true;
            if (v === 'false' || v === '0') return false;
        }

        return undefined;
    }, { toClassOnly: true }); // <-- THIS IS WHERE IT GOES
}
