// src/common/utils/mongoose-lookup.util.ts

import { PipelineStage } from 'mongoose';

/**
 * ✅ Reusable helper to perform a $lookup and optional $unwind
 * - Makes aggregation cleaner and type-safe
 * - Supports selective projection
 */
export const lookupAndUnwind = (
    localField: string,
    from: string,
    as: string,
    projectFields: Record<string, 1> = {},
    unwind: boolean = true,
): PipelineStage[] => {
    const stages: PipelineStage[] = [
        {
            $lookup: {
                from,
                localField,
                foreignField: '_id',
                as,
                pipeline: [{ $project: projectFields }],
            },
        },
    ];

    if (unwind) {
        stages.push({
            $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: true },
        });
    }

    return stages;
};
