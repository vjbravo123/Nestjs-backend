import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AddOnHistory, AddOnHistoryDocument } from './addon-history.schema';
import { deepDiff } from '../../common/utils/deep-diff.util';
@Injectable()
export class AddOnHistoryService {
  private readonly logger = new Logger(AddOnHistoryService.name);

  constructor(
    @InjectModel(AddOnHistory.name)
    private readonly historyModel: Model<AddOnHistoryDocument>,
  ) { }

  /**
   * Record AddOn edit history (by admin or vendor)
   */
  async recordHistory(params: {
    addOnId: Types.ObjectId;
    updatedBy: Types.ObjectId;
    updatedByRole: 'admin' | 'vendor';
    oldData: Record<string, any>;
    newData: Record<string, any>;
    updateStatus: 'approved' | 'rejected' | 'edit_by_admin';
    comment?: string;
  }): Promise<void> {
    // console.log("recordHistory params inside the addon history:", params);
    const { addOnId, updatedBy, updatedByRole, oldData, newData, updateStatus, comment } = params;
    console.log("old data inside addon history service:", oldData);
    console.log("new data inside addon history service:", newData);
    // Detect changes
    const changes: Record<string, { oldValue: any; newValue: any }> = {};

    for (const key of Object.keys(newData)) {
      const oldVal = oldData[key];
      const newVal = newData[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes[key] = { oldValue: oldVal, newValue: newVal };
      }
    }


    // const getChangesByDeepDiff = deepDiff(oldData, newData);
    // console.log("detected changes by deep diff:", getChangesByDeepDiff);
    // console.log("detected changes inside addon history service:", changes);
    if (Object.keys(changes).length === 0) {
      this.logger.debug(`No changes detected for AddOn ${addOnId}`);
      return;
    }

    await this.historyModel.create({
      addOnId,
      updatedBy,
      updatedByRole,
      changes,
      comment,
      updateStatus: params.updateStatus,
    });

    this.logger.log(
      `AddOn ${addOnId} updated by ${updatedByRole} (${updatedBy.toString()}) with ${Object.keys(changes).length} field changes`,
    );
  }

  /**
   * Fetch all history for a given AddOn
   */
  async getHistory(addOnId: string) {
    return this.historyModel
      .find({ addOnId })
      .sort({ createdAt: -1 })
      .populate('updatedBy', 'name email role')
      .lean();
  }


  async getLastRejectedChanges(eventIds: Types.ObjectId[] | string[]) {
    console.log("eventIds in getLastRejectedChanges:", eventIds);
    const objectIds = eventIds.map(id => new Types.ObjectId(id));

    const rejectedChanges = await this.historyModel.aggregate([
      {
        $match: {
          addOnId: { $in: objectIds },
          updatedByRole: 'admin',
          updateStatus: 'rejected',
        },
      },
      { $sort: { changedAt: -1 } },
      {
        $group: {
          _id: '$addOnId',
          lastRejectedChanges: { $first: '$changes' },
          lastRejectedReason: { $first: '$changes.reason' },
          rejectedAt: { $first: '$changedAt' },
        },
      },



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
    console.log('result from getLastRejectedChanges:', result);
    return result;
  }

}
