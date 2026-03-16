/* eslint-disable no-param-reassign */
import { Schema } from 'mongoose';

const aggregatePaginate = (schema: Schema) => {
    schema.statics.paginate = async function (filter = {}, options: any = {}) {
        console.log('Aggregate Paginate options:', options);

        try {
            const limit = Math.max(parseInt(options.limit, 10) || 10, 1);
            const page = Math.max(parseInt(options.page, 10) || 1, 1);
            const skip = (page - 1) * limit;

            // 🟢 1. Base pipeline
            const pipeline: any[] = [];

            // $match (filters)
            if (Object.keys(filter).length > 0) {
                pipeline.push({ $match: filter });
            }

            // 🟢 2. Lookup (populate equivalent)
            if (options.populate) {
                const populateFields = options.populate.split(';');
                populateFields.forEach((field: string) => {
                    const [path, selectFields] = field.split(':').map((f) => f.trim());

                    if (path) {
                        pipeline.push({
                            $lookup: {
                                from: path + 's', // assumes plural naming (adjust if needed)
                                localField: `${path}Id`,
                                foreignField: '_id',
                                as: path,
                            },
                        });

                        // Optional: flatten the result
                        pipeline.push({ $unwind: { path: `$${path}`, preserveNullAndEmptyArrays: true } });

                        // Optional: projection inside the lookup
                        if (selectFields) {
                            const selected = selectFields.split(',').reduce((acc, f) => {
                                acc[`${path}.${f.trim()}`] = 1;
                                return acc;
                            }, {});
                            pipeline.push({ $project: selected });
                        }
                    }
                });
            }

            // 🟢 3. Sorting
            let sortStage: Record<string, 1 | -1>;
            if (options.sortBy) {
                sortStage = {};
                const sorts = options.sortBy.split(',');
                sorts.forEach((s: string) => {
                    const [key, order] = s.split(':');
                    sortStage[key] = order === 'desc' ? -1 : 1;
                });
            } else {
                sortStage = { createdAt: -1 };
            }

            pipeline.push({ $sort: sortStage });

            // 🟢 4. Projection (select)
            if (options.select) {
                const fields = options.select.split(',').reduce((acc: any, f: string) => {
                    acc[f.trim()] = 1;
                    return acc;
                }, {});
                pipeline.push({ $project: fields });
            }

            // 🟢 5. Pagination stages
            pipeline.push({ $skip: skip });
            pipeline.push({ $limit: limit });

            // 🟢 6. Count total results (separate query)
            const countPipeline = [{ $match: filter }, { $count: 'total' }];
            const countResult = await this.aggregate(countPipeline);
            const totalResults = countResult.length > 0 ? countResult[0].total : 0;
            const totalPages = Math.ceil(totalResults / limit);

            // 🟢 7. Execute main pipeline
            const results = await this.aggregate(pipeline);

            return {
                results,
                page,
                limit,
                totalPages,
                totalResults,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
            };
        } catch (error: any) {
            throw new Error(`Aggregation Pagination Error: ${error.message}`);
        }
    };
};

export { aggregatePaginate };
