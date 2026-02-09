import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import { EventChangeHistory, EventChangeHistoryDocument } from './event-change-history.schema';



const lookupAndUnwind = (
    localField: string,
    from: string,
    as: string,
    projectFields: Record<string, 1> = {},
    unwind = true
): PipelineStage[] => {
    const stages: PipelineStage[] = [
        { $lookup: { from, localField, foreignField: '_id', as, pipeline: [{ $project: projectFields }] } },
    ];
    if (unwind) stages.push({ $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: true } });
    return stages;
};
@Injectable()
export class EventChangeHistoryService {
    constructor(
        @InjectModel(EventChangeHistory.name)
        private readonly historyModel: Model<EventChangeHistoryDocument>,
    ) { }

    /**
     * Logs changes for a given event
     * @param eventId - the event that was changed
     * @param changedBy - the user id (vendor/admin) who made the change
     * @param changedByRole - 'vendor' | 'admin'
     * @param changes - object containing old and new values for each changed field
     */
    async logChange(
        eventId: Types.ObjectId,
        changedBy: Types.ObjectId,
        changedByRole: 'admin' | 'vendor',
        changes: Record<string, any>, // 👈 relaxed type (was Record<string, { old; new; }>)
        status: 'pending' | 'approved' | 'rejected' = 'pending',
    ) {
        if (!Object.keys(changes).length) return; // skip if nothing changed

        const history = new this.historyModel({
            eventId,
            changedBy,
            changedByRole,
            changes,
            status,
            changedAt: new Date(),
        });

        return await history.save();
    }


    /**
     * Get change history for a specific event
     * @param eventId
     */
    async getHistoryForEvent(eventId: string | Types.ObjectId) {
        return this.historyModel
            .find({ eventId })
            .sort({ changedAt: -1 })
            .lean()
            .exec();
    }



    async getLastRejectedChanges(eventIds: Types.ObjectId[] | string[]) {
        console.log()
        const objectIds = eventIds.map(id => new Types.ObjectId(id));

        const rejectedChanges = await this.historyModel.aggregate([
            {
                $match: {
                    eventId: { $in: objectIds },
                    changedByRole: 'admin',
                    status: 'rejected',
                },
            },
            { $sort: { changedAt: -1 } },
            {
                $group: {
                    _id: '$eventId',
                    lastRejectedChanges: { $first: '$changes' },
                    lastRejectedReason: { $first: '$changes.reason' },
                    rejectedAt: { $first: '$changedAt' },
                },
            },
            // ✅ Lookup for experientialEventCategory
            {
                $lookup: {
                    from: 'dropdownoptions', // 👈 collection name (check exact)
                    localField: 'lastRejectedChanges.experientialEventCategory',
                    foreignField: '_id',
                    as: 'lastRejectedChanges.experientialEventCategory',
                    pipeline: [{ $project: { name: 1, value: 1, label: 1 } }],
                },


            },
            {
                $unwind: {
                    path: '$lastRejectedChanges.experientialEventCategory',
                    preserveNullAndEmptyArrays: true,
                },
            },
            // // ✅ Lookup for subExperientialEventCategory
            {
                $lookup: {
                    from: 'subexperientialeventcategories', // 👈 collection name (check exact)
                    localField: 'lastRejectedChanges.subExperientialEventCategory',
                    foreignField: '_id',
                    as: 'lastRejectedChanges.subExperientialEventCategory',
                    pipeline: [
                        { $project: { name: 1, value: 1, experientialEventCategoryId: 1 } },
                    ],
                },



            },
            {
                $unwind: {
                    path: '$lastRejectedChanges.subExperientialEventCategory',
                    preserveNullAndEmptyArrays: true,
                },
            },
            // // ✅ Simplify results


        ]);


        console.log("rejectedChanges in history: ", rejectedChanges);
        const result: Record<string, any> = {};
        for (const item of rejectedChanges) {
            result[item._id.toString()] = {
                lastRejectedChanges: item.lastRejectedChanges || null,
                lastRejectedReason: item.lastRejectedReason || null,
                rejectedAt: item.rejectedAt || null,
            };
        }

        return result;
    }




    async getChangeHistoryForEvent(eventId: string | Types.ObjectId) {
        const id =
            eventId instanceof Types.ObjectId
                ? eventId
                : new Types.ObjectId(eventId);

        return this.historyModel.aggregate([
            { $match: { eventId: id } },

            // 🔍 Lookup the user who made the change
            {
                $lookup: {
                    from: 'users',
                    localField: 'changedBy',
                    foreignField: '_id',
                    as: 'changedBy',
                    pipeline: [
                        { $project: { _id: 1, name: 1, email: 1, role: 1 } }
                    ]
                }
            },
            { $unwind: { path: '$changedBy', preserveNullAndEmptyArrays: true } },

            // ✅ Lookup experientialEventCategory safely (renamed as changesCategory)
            {
                $lookup: {
                    from: 'dropdownoptions',
                    localField: 'changes.experientialEventCategory',
                    foreignField: '_id',
                    as: 'changes.experientialEventCategory',
                    pipeline: [
                        { $project: { _id: 1, name: 1, label: 1, value: 1 } }
                    ]
                }
            },
            { $unwind: { path: '$changes.experientialEventCategory', preserveNullAndEmptyArrays: true } },

            // ✅ Lookup subExperientialEventCategory (array)
            {
                $lookup: {
                    from: 'subexperientialeventcategories',
                    localField: 'changes.subExperientialEventCategory',
                    foreignField: '_id',
                    as: 'changes.subExperientialEventCategory',
                    pipeline: [
                        { $project: { _id: 1, name: 1, label: 1, value: 1 } }
                    ]
                }
            },

            // ✅ Clean projection — avoid path collision
            {
                $project: {
                    _id: 1,
                    eventId: 1,
                    changedByRole: 1,
                    status: 1,
                    changedAt: 1,
                    rejectReason: 1,

                    changedBy: 1,
                    changes: 1, // keep original nested changes object

                    // Add your looked-up data as separate, non-conflicting fields
                    changesCategory: 1,
                    subExperientialCategories: 1
                }
            },

            { $sort: { changedAt: -1 } }
        ]);
    }
    async getChangeHistoryForEventByEventAndStatus(
        eventId: string | Types.ObjectId,
        status: 'pending' | 'approved' | 'rejected'
    ) {
        const id =
            eventId instanceof Types.ObjectId
                ? eventId
                : new Types.ObjectId(eventId);

        return this.historyModel.aggregate([
            { $match: { eventId: id, status } },

            // 🔍 Lookup user who made the change
            {
                $lookup: {
                    from: 'users',
                    localField: 'changedBy',
                    foreignField: '_id',
                    as: 'changedBy',
                    pipeline: [
                        { $project: { _id: 1, name: 1, email: 1, role: 1 } }
                    ]
                }
            },
            { $unwind: { path: '$changedBy', preserveNullAndEmptyArrays: true } },

            // ✅ Lookup experientialEventCategory
            {
                $lookup: {
                    from: 'dropdownoptions',
                    localField: 'changes.experientialEventCategory',
                    foreignField: '_id',
                    as: 'changes.experientialEventCategory',
                    pipeline: [
                        { $project: { _id: 1, name: 1, label: 1, value: 1 } }
                    ]
                }
            },
            { $unwind: { path: '$changes.experientialEventCategory', preserveNullAndEmptyArrays: true } },

            // ✅ Lookup subExperientialEventCategory (array)
            {
                $lookup: {
                    from: 'subexperientialeventcategories',
                    localField: 'changes.subExperientialEventCategory',
                    foreignField: '_id',
                    as: 'changes.subExperientialEventCategory',
                    pipeline: [
                        { $project: { _id: 1, name: 1, label: 1, value: 1 } }
                    ]
                }
            },
            { $unwind: { path: '$changes.subExperientialEventCategory', preserveNullAndEmptyArrays: true } },

            // ✅ Project final shape
            {
                $project: {
                    _id: 1,
                    eventId: 1,
                    changedByRole: 1,
                    status: 1,
                    changedAt: 1,
                    rejectReason: 1,
                    changedBy: 1,
                    changes: 1
                }
            },

            { $sort: { changedAt: -1 } }
        ]);
    }


}
