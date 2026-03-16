import { Schema } from 'mongoose';

// Fields to remove from all toJSON and toObject outputs
const hiddenFields = ['password', '__v'];

function transform(doc: any, ret: any, options: any) {
  // Remove hidden fields
  for (const field of hiddenFields) {
    if (ret[field] !== undefined) {
      delete ret[field];
    }
  }
  // Optionally, remove _id and add id
  if (ret._id) {
    ret.id = ret._id.toString();
    delete ret._id;
  }
  return ret;
}

export function mongooseGlobalTransformPlugin(schema: Schema) {
  schema.set('toJSON', { transform });
  schema.set('toObject', { transform });
}