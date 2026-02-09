import { Request, Response, NextFunction } from 'express';
import { parse } from 'path';

export function booleanNormalizer(req: Request, res: Response, next: NextFunction) {
    const parseBooleans = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;

        for (const key in obj) {
            const value = obj[key];
            if (typeof value === 'string') {
                const val = value.trim().toLowerCase();
                if (val === 'true') obj[key] = true;
                else if (val === 'false') obj[key] = false;
            } else if (Array.isArray(value)) {
                value.forEach(item => {
                    if (typeof item === 'object') parseBooleans(item);
                });
            } else if (typeof value === 'object') {
                parseBooleans(value);
            }
        }
    };


    parseBooleans(req.body);
    parseBooleans(req.query);
    // console.log('🟢 After booleanNormalizer:', JSON.stringify(req.body, null, 2));

    next();
}
