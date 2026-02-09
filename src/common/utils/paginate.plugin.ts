// src/common/utils/paginate.plugin.ts
/* eslint-disable no-param-reassign */
import { Schema } from 'mongoose';

const paginate = (schema: Schema) => {
  schema.statics.paginate = async function (filter = {}, options: any = {}) {
    console.log('Paginate final filter data:', filter);
    console.log('Paginate options:', options);

    try {
      const limit = Math.max(parseInt(options.limit, 10) || 10, 1);

      // 🟢 Sorting
      const sort = options.sortBy
        ? options.sortBy
          .split(',')
          .map((s: string) => {
            if (s.includes(':desc')) {
              return `-${s.replace(':desc', '').replace('[0]', '.0')}`;
            }
            return s.replace(':asc', '').replace('[0]', '.0');
          })
          .join(' ')
        : { createdAt: -1 };

      // 🟢 Field selection
      let select: string | undefined;
      if (options.select) {
        select = options.select
          .split(',')
          .map((f: string) => f.trim())
          .join(' ');
      }

      // ------------------------
      // CURSOR-BASED PAGINATION
      // ------------------------
      if (options.cursor !== undefined) {
        const cursorFilter = options.cursor
          ? { _id: { $gt: options.cursor } }   // subsequent pages
          : {};

        let query = this.find({ ...filter, ...cursorFilter })
          .sort(sort)
          .limit(limit + 1); // fetch one extra to check next page

        if (select) query = query.select(select);

        // 🟢 Population
        if (options.populate) {
          const populateFields = options.populate.split(';');
          populateFields.forEach((field: string) => {
            const [path, selectFields] = field.split(':').map((f) => f.trim());
            if (path) {
              const populateOptions: any = { path };
              if (selectFields) {
                populateOptions.select = selectFields
                  .split(',')
                  .map((f) => f.trim()) 
                  .join(' ');
              }
              query = query.populate(populateOptions);
            }
          });
        }

        query = query.lean();
        let data = await query.exec();

        let nextCursor: string | null = null;
        if (data.length > limit) {
          const nextDoc = data.pop();
          nextCursor = nextDoc._id.toString();
        }

        return {
          results: data,
          limit,
          nextCursor,
          hasNextPage: !!nextCursor,
        };
      }

      // ------------------------
      // OFFSET-BASED PAGINATION
      // ------------------------
      const page = Math.max(parseInt(options.page, 10) || 1, 1);
      const skip = (page - 1) * limit;

      const totalResults = await this.countDocuments(filter);

      let query = this.find(filter).sort(sort).skip(skip).limit(limit);

      if (select) query = query.select(select);

      if (options.populate) {
        const populateFields = options.populate.split(';');
        populateFields.forEach((field: string) => {
          const [path, selectFields] = field.split(':').map((f) => f.trim());
          if (path) {
            const populateOptions: any = { path };
            if (selectFields) {
              populateOptions.select = selectFields
                .split(',')
                .map((f) => f.trim())
                .join(' ');
            }
            query = query.populate(populateOptions);
          }
        });
      }

      query = query.lean();
      const data = await query.exec();

      const totalPages = Math.ceil(totalResults / limit);

      return {
        results: data,
        page,
        limit,
        totalPages,
        totalResults,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      };
    } catch (error: any) {
      throw new Error(`Pagination Error: ${error.message}`);
    }
  };
};

export { paginate };
