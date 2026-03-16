import { createMongoAbility, MongoAbility } from '@casl/ability';

/**
 * All actions an actor can perform on a subject.
 * `Manage` is a CASL built-in that represents every action.
 */
export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
  Approve = 'approve',
}

/**
 * All resources (subjects) in the system.
 * String literals keep things lightweight — no need for class references.
 * Add a new entry here whenever a new protected resource is introduced.
 */
export type Subject =
  | 'Order'
  | 'Cart'
  | 'DraftCart'
  | 'CheckoutIntent'
  | 'VendorAvailability'
  | 'AddOn'
  | 'Vendor'
  | 'User'
  | 'all';

/**
 * The concrete ability type used throughout the application.
 * MongoAbility supports condition-based rules for document-level authorization.
 */
export type AppAbility = MongoAbility<[Action, Subject]>;

export { createMongoAbility };
