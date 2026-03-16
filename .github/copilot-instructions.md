# Agent Instructions — Zappyeventz Backend Coding Standards

> **Purpose**: These instructions govern ALL code written or modified in this repository.
> Every agent must follow these standards without exception to ensure enterprise-grade
> quality, reusability, and maintainability.

---

## 1. Project Stack Reference

| Layer | Technology |
|---|---|
| Framework | NestJS (TypeScript) |
| Database | MongoDB via Mongoose (`@nestjs/mongoose`) |
| Auth | JWT (httpOnly cookies) + OTP mobile flow |
| Cache / Sessions | Redis (`ioredis`) |
| Queue | Bull/BullMQ |
| Logging | Winston (`src/common/utils/logger.ts`) |
| Error Handling | Global `HttpExceptionFilter` (`src/common/filters/`) |
| Events | `EventEmitter2` for side-effects |
| Validation | `class-validator` + `class-transformer` on all DTOs |

---

## 2. Architecture: Layer Responsibilities

### Strict layering — never skip a layer.

```
Request → Controller → Service → (SubService | Repository) → Database
```

### Controller
- **Only** handles HTTP concerns: routing, guards, decorators, pipes, response shaping.
- Must NOT contain any business logic or database queries.
- Must NOT import `Model<T>` or Mongoose directly.
- Must validate input via DTOs and pipes.
- Must return the service result directly — no re-mapping unless shaping a response envelope.

```typescript
// ✅ CORRECT
@Get(':orderId')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('user')
async getOrder(
  @Param('orderId', MongoIdPipe) orderId: Types.ObjectId,
  @CurrentUser() user: AuthUser,
) {
  return this.orderService.getUserOrderById(orderId, user.userId);
}

// ❌ WRONG — business logic in controller
@Get(':orderId')
async getOrder(@Param('orderId') orderId: string) {
  if (!Types.ObjectId.isValid(orderId)) throw new BadRequestException('...');
  const order = await this.orderModel.findById(orderId);
  if (order.userId !== req.user.id) throw new ForbiddenException();
  return order;
}
```

### Service
- Contains ALL business logic.
- May call other services via constructor injection.
- Must NEVER reach into another module's Model directly — call that module's service.
- Must throw typed NestJS HTTP exceptions (`NotFoundException`, `ForbiddenException`, etc.) — never raw `Error`.
- Large services (>500 lines) MUST be split into focused sub-services.

### Sub-Service (domain slice)
- A service that handles one bounded concern (e.g. `OrderPaymentService`, `OrderFulfillmentService`).
- Lives inside the module's `services/` folder.
- Injected into the parent service — not exposed in the controller directly.

---

## 3. Module Structure

Every feature module follows this exact structure:

```
modules/feature/
  feature.module.ts          # Module definition, imports, providers
  feature.controller.ts      # HTTP routing only
  feature.service.ts         # Orchestration — composes sub-services
  feature.schema.ts          # Mongoose schema + types
  dto/
    create-feature.dto.ts
    update-feature.dto.ts
    query-feature.dto.ts      # Pagination/filter DTOs
  services/
    feature-payment.service.ts    # Domain slice service
    feature-snapshot.service.ts
  guards/                    # Feature-local guards if needed
  types/                     # Feature-local types/interfaces
```

---

## 4. Naming Conventions

| Artifact | Convention | Example |
|---|---|---|
| File | `kebab-case` | `order-payment.service.ts` |
| Class | `PascalCase` | `OrderPaymentService` |
| Method | `camelCase`, verb-first | `createOrder`, `findByUserId` |
| Variable | `camelCase` | `totalSubtotal` |
| Constant | `SCREAMING_SNAKE_CASE` | `MAX_ACTIVE_SESSIONS` |
| Enum | `PascalCase` key, `SCREAMING_SNAKE` value | `OrderStatus.CONFIRMED` |
| DTO | `PascalCase` + suffix | `CreateOrderDto`, `AdminOrdersQueryDto` |
| Interface/Type | `PascalCase`, no `I` prefix | `AuthUser`, `DeviceInfo` |
| Guard | `PascalCase` + `Guard` suffix | `OwnershipGuard` |
| Decorator | `PascalCase` | `@CurrentUser()`, `@Roles()` |

---

## 5. DTOs — Validation Rules

- Every request body, query param set, and route param set has a dedicated DTO.
- All DTO properties use `class-validator` decorators.
- Query DTOs extend pagination helpers when listing.
- Use `@IsOptional()` for optional fields — never `?` alone without a validator.
- Use `@Transform()` from `class-transformer` for type coercion (strings→numbers, strings→booleans).
- Never access `req.body` directly in controllers — always use typed DTOs.

```typescript
// ✅ CORRECT DTO
export class UserOrdersQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}

// ❌ WRONG — no validation
export class UserOrdersQueryDto {
  page?: number;
  status?: string;
}
```

---

## 6. Error Handling

### Always use NestJS typed exceptions. Never throw `new Error()`.

| Situation | Exception |
|---|---|
| Resource not found | `NotFoundException` |
| Wrong input / bad data | `BadRequestException` |
| Not authenticated | `UnauthorizedException` |
| Authenticated but not allowed | `ForbiddenException` |
| Resource already exists | `ConflictException` |
| Rate limit / too many requests | `HttpException(..., 429)` |
| OTP already used | `HttpException(..., HttpStatus.GONE)` |
| Server / unexpected errors | Let bubble to global `HttpExceptionFilter` |

```typescript
// ✅ CORRECT
if (!order) throw new NotFoundException('Order not found');
if (order.userId.toString() !== userId.toString()) {
  throw new ForbiddenException('You do not own this order');
}

// ❌ WRONG
if (!order) throw new Error('Order not found');
if (!order) return null; // Silent failure — never do this
```

### The global `HttpExceptionFilter` handles:
- `HttpException` subclasses → structured JSON response
- Mongo duplicate key (11000) → `409 Conflict`
- Mongoose `ValidationError` → `400 Bad Request`
- All other errors → `500` with sanitized message in production

Do not re-implement this logic in services.

---

## 7. Logging Standards

### Use the Winston logger — NEVER `console.log` in production code.

```typescript
import logger from 'src/common/utils/logger';

// ✅ CORRECT
logger.info('Order created', { orderId: order._id, orderNumber: order.orderNumber });
logger.error('Payment verification failed', { paymentId, error: err.message });
logger.warn('OTP attempt limit reached', { mobile: masked });

// ❌ WRONG
console.log('Order created', order);
console.log('user id', userId); // PII leak
```

### PII Rules — NEVER log:
- Mobile numbers (use last 4 digits only: `****${mobile.slice(-4)}`)
- Email addresses
- Full names
- JWT tokens or OTPs
- Payment card details
- Raw request bodies containing any of the above

```typescript
// ✅ Safe logging
logger.info('OTP verified', { mobile: `****${mobile.slice(-4)}` });

// ❌ PII leak
logger.info('OTP verified for', { mobile });
```

---

## 8. Security — RBAC & Ownership

### Every protected route MUST have both guards applied:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('user')          // or 'vendor', 'admin', or multiple
```

### Ownership enforcement — must be done in the SERVICE, not the controller:

```typescript
// ✅ CORRECT — service enforces ownership
async getUserOrderById(orderId: Types.ObjectId, userId: Types.ObjectId) {
  const order = await this.orderModel.findById(orderId);
  if (!order) throw new NotFoundException('Order not found');
  if (order.userId.toString() !== userId.toString()) {
    throw new ForbiddenException('Access denied');
  }
  return order;
}

// ❌ WRONG — ownership check in controller
async getOrder(@Param('orderId', MongoIdPipe) orderId, @CurrentUser() user) {
  const order = await this.orderService.getById(orderId);
  if (order.userId !== user.userId) throw new ForbiddenException();
  return order;
}
```

### Ownership Guard pattern for reusable cross-cutting checks:
- Use `@OwnershipGuard()` decorator + guard for resource ownership (implemented in Phase 2).
- Ownership is always checked by matching the resource's `userId`/`vendorId` against the JWT's `userId`/`vendorId`.
- `adminId` present in JWT → admin bypass is allowed only on explicitly admin-scoped routes.

### Admin routes:
- Must be on a separate path prefix (`/admin/...` or `orders/admin/...`).
- Must have `@Roles('admin')` — never mix admin routes with user routes.
- Admin actions that mutate data must log the `adminId` for audit.

---

## 9. MongoDB / Mongoose Patterns

### Schema definitions:
- All schemas define explicit TypeScript interfaces (`Document` types).
- Use `@Prop()` for all fields — no implicit schema fields.
- Add `index: true` to frequently queried fields.
- Use `{ type: Date, expires: 0 }` for TTL fields (auto-delete by MongoDB).
- Always define `timestamps: true` in `SchemaOptions`.

```typescript
// ✅ CORRECT
@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: OrderStatus, index: true })
  status: OrderStatus;
}
```

### Queries:
- Always project only the fields needed (`select()`).
- Use `.lean()` for read-only aggregations (returns plain objects, faster).
- Never use `findOne` + save for updates — use `findByIdAndUpdate` / `updateOne` with `$set`.
- Use MongoDB sessions (`startSession()`) for multi-document writes.

```typescript
// ✅ CORRECT — atomic update, no race condition
await this.orderModel.updateOne(
  { _id: orderId },
  { $set: { status: OrderStatus.CONFIRMED, confirmedAt: new Date() } },
);

// ❌ WRONG — read-modify-write race condition
const order = await this.orderModel.findById(orderId);
order.status = 'confirmed';
await order.save();
```

### Aggregations:
- Use `lookupAndUnwind` util from `src/common/utils/mongoose-lookup.util.ts` for single-result lookups.
- Always add `$match` as the first stage for index utilization.
- Break complex aggregations into named stages with comments.

---

## 10. Service Decomposition Rules

When a service exceeds **500 lines** or contains **more than 3 distinct concerns**, split it.

### Splitting criteria:
| Concern | Sub-service name |
|---|---|
| Payment verification & coupon logic | `OrderPaymentService` |
| Snapshot creation (event/addon data at order time) | `OrderSnapshotService` |
| Fulfillment (availability, vendor bookings) | `OrderFulfillmentService` |
| Query/listing (user, vendor, admin views) | `OrderQueryService` |
| Status transitions | `OrderStatusService` |

### How to split safely (no behavior change):
1. Create sub-service file in `services/` folder.
2. Move methods into sub-service — copy constructor injections needed.
3. Register sub-service as a provider in the module.
4. Inject sub-service into parent service.
5. Replace parent service method body with a call to sub-service.
6. Run build — fix TypeScript errors only — no logic changes.
7. Commit as a single refactor commit.

---

## 11. Dependency Injection Rules

- Inject services by their class type — never use `string` tokens unless necessary.
- Inject `Model<T>` only in the service that directly owns that collection.
- Other modules access data through the owning module's exported service.
- Circular dependencies — solve with `forwardRef()`, but prefer redesigning to avoid them.

```typescript
// ✅ CORRECT — cross-module access via service
constructor(private readonly cartService: CartService) {}

// ❌ WRONG — direct model injection from another module
@InjectModel(Cart.name) private cartModel: Model<Cart>
```

---

## 12. Events & Side Effects

- Use `EventEmitter2` for any side effect that should not block the main response:
  - Email notifications
  - Push notifications
  - Audit logging
  - Analytics events

```typescript
// ✅ CORRECT — non-blocking
this.eventEmitter.emit('order.created', { orderId: order._id, userId });

// ❌ WRONG — blocks response
await this.emailService.sendOrderConfirmation(userId, order);
```

- Event listeners live in `src/events/` and are named `<domain>-events.listener.ts`.

---

## 13. Response Shape

All successful responses use this envelope (enforced by the global transform — do not re-wrap manually):

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional human message",
  "meta": { "page": 1, "total": 100 }   // pagination only
}
```

- Never return raw Mongoose documents — `.lean()` or `.toObject()` first.
- Never expose `__v`, internal `_id` arrays, or hashed tokens in responses.
- Paginated list responses always include `meta` with `page`, `limit`, `total`.

---

## 14. Common Shared Utilities — Use, Don't Recreate

| Utility | Location | Purpose |
|---|---|---|
| `MongoIdPipe` | `src/common/pipes/parse-objectid.pipe.ts` | Validate & cast route param to `ObjectId` |
| `@CurrentUser()` | `src/common/decorators/current-user.decorator.ts` | Extract JWT user from request |
| `@Roles()` | `src/common/decorators/roles.decorator.ts` | Declare required roles |
| `RolesGuard` | `src/common/guards/roles.guard.ts` | Enforce `@Roles()` |
| `logger` | `src/common/utils/logger.ts` | Winston logger |
| `lookupAndUnwind` | `src/common/utils/mongoose-lookup.util.ts` | Mongo $lookup + $unwind helper |
| `paginate` plugin | `src/common/utils/paginate.plugin.ts` | Cursor/offset pagination |
| `HttpExceptionFilter` | `src/common/filters/http-exception.filter.ts` | Global error handler |

> Before creating a new utility, search `src/common/` first. If a similar utility exists, extend it rather than duplicating.

---

## 15. Git Commit Standards

Follow Conventional Commits:

```
<type>(<scope>): <short description>

<body — what and why, not how>
```

| Type | When |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring with no behavior change |
| `security` | Security fix or hardening |
| `chore` | Config, deps, tooling |
| `test` | Tests only |
| `docs` | Documentation only |

Examples:
```
refactor(order): split OrderService into payment, snapshot, fulfillment sub-services
feat(guards): add OwnershipGuard for user/vendor resource protection
security(auth): enforce ownership check in getUserOrderById
```

---

## 16. Security Best Practices

### Authentication & Authorization
- Every non-public route MUST apply `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(...)`.
- JWTs are transmitted via **httpOnly cookies only** — never in `Authorization` headers or URL params unless explicitly required by a third-party integration.
- JWT payload must carry `tokenVersion`. On every request the guard must verify the token's `tokenVersion` matches the entity's current value in DB.
- `tokenVersion` is incremented **only** during force-logout (`invalidateSessions`) — never on regular login or token refresh.
- Refresh tokens are **hashed with bcrypt** before storage in `activeSessions`. Raw token is never persisted.
- Admin tokens stored in the `Token` collection must have a TTL and `isRevoked` flag checked on every use.

### OTP Security
- OTP values are stored in Redis only — never in MongoDB.
- OTPs expire after a short TTL (max 10 minutes).
- Verification uses atomic `GETDEL` — the OTP is consumed on first successful claim, preventing concurrent double-submission.
- Brute-force protection: max 5 wrong attempts → 15-minute lockout using Redis `INCR` + `EXPIRE`.
- Resend rate limit: max 3 resends per 10-minute window.
- On account lockout, respond with `429` and include `retryAfter` seconds in the response.

### Input Validation & Injection Prevention
- All input (body, query, params) goes through `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true`.
- Route params that are MongoDB IDs must go through `MongoIdPipe` — never call `new Types.ObjectId(rawString)` in controllers or services without prior validation.
- Do not construct raw MongoDB queries from user input. Use DTO fields mapped to typed query builders.
- Never use `$where`, `eval`, or raw JS expressions in Mongo queries.
- Sanitize all string fields used in regex queries with `escapeRegExp` to prevent ReDoS.

```typescript
// ✅ CORRECT — safe regex search
const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const filter = { name: { $regex: escaped, $options: 'i' } };

// ❌ WRONG — ReDoS vulnerability
const filter = { name: { $regex: query, $options: 'i' } };
```

### Secrets & Configuration
- No secrets, API keys, or credentials in source code — ever.
- All secrets sourced from `process.env` via the validated `config` module (`src/config/env.validator.ts`).
- Missing required env vars throw at startup, not at runtime.
- Different secrets per environment (production never shares keys with dev/qa).

### HTTP Security Headers
- Helmet is globally enabled in `main.ts` — do not disable any default Helmet protections.
- CORS is configured to explicit origin allowlist — never use `origin: '*'` in production.
- Body size is capped (currently 50 MB) — do not raise this limit without architectural review.

### Rate Limiting
- Global `ThrottlerGuard` is applied via `APP_GUARD` — all routes are rate-limited by default.
- Sensitive endpoints (OTP send, login, password reset) must have stricter in-service rate limits using Redis counters in addition to the global throttler.
- Rate limit responses always return `429` with a `Retry-After` field.

### Data Exposure
- Never return password hashes, OTPs, raw tokens, or private keys in any API response.
- Use `select: false` on sensitive schema fields (e.g., hashed tokens, internal flags).
- Response DTOs or `.select('-sensitiveField')` must be used on all user-facing queries.
- Admin-only fields (e.g. `failedLoginAttempts`, `isLocked`) must never appear in user-facing responses.

---

## 17. Reliability Best Practices

### Transactional Writes
- Any operation that writes to **more than one collection** atomically must use a MongoDB session + transaction.
- Always `session.abortTransaction()` in the `catch` block and `session.endSession()` in `finally`.

```typescript
// ✅ CORRECT pattern
const session = await this.connection.startSession();
session.startTransaction();
try {
  await this.orderModel.create([orderDoc], { session });
  await this.cartModel.updateOne({ _id: cartId }, { $set: { checked: true } }, { session });
  await session.commitTransaction();
} catch (err) {
  await session.abortTransaction();
  throw err;
} finally {
  session.endSession();
}
```

### Idempotency
- Order creation, payment verification, and OTP verification must be idempotent.
- Use a unique `idempotencyKey` or natural business key (e.g. `paymentId`) checked before processing.
- Duplicate operations must return the existing result, not throw an error or create duplicates.

### Redis Resilience
- All Redis operations must be wrapped in `try/catch`.
- Redis failures must **not** crash the core request flow — degrade gracefully (e.g. skip rate-limit check if Redis is down, log a warning).
- Use Redis key namespacing to avoid collisions: `otp:{mobile}`, `otpAttempts:{mobile}`, `otpResend:{mobile}`, `session:{jti}`.

```typescript
// ✅ CORRECT — Redis failure is non-fatal for non-critical path
try {
  await this.redisClient.incr(attemptsKey);
} catch (redisErr) {
  logger.warn('Redis unavailable for attempt tracking', { error: redisErr.message });
}
```

### Async Error Boundaries
- All `async` service methods must propagate errors — never swallow with empty `catch {}`.
- Event listeners (side-effects via `EventEmitter2`) must have their own `try/catch` — a failed email must not affect the order response.
- Bull/BullMQ workers must have a `failed` handler that logs the job data and error for replay.

### Health Checks
- The `/health` endpoint must remain lightweight — it checks liveness only (is the process alive?).
- A `/health/ready` endpoint should check MongoDB and Redis connectivity before marking as ready.
- Never add business logic to health check endpoints.

### Retries
- Transient external failures (MSG91, PhonePe, S3) must be retried with exponential backoff — do not retry immediately in a loop.
- Max 3 retry attempts with `[1s, 2s, 4s]` delays.
- Non-transient errors (400 Bad Request from external API) must NOT be retried.

---

## 18. Scalability Best Practices

### Stateless Services
- Services must be fully stateless — no in-memory caches, counters, or user state stored on the Node process.
- All shared state (sessions, counters, locks, OTPs) lives in **Redis**.
- All persistent state lives in **MongoDB**.
- This allows horizontal scaling (multiple Render instances) without session affinity.

### Database Query Performance
- Every query that filters on a field must have a corresponding index on that schema field.
- Compound indexes must be defined with the most selective field first.
- Avoid unbounded queries — always apply a `limit` to any `find()` that could return multiple documents.
- Use `explain()` in dev to verify index usage before merging new aggregations.
- Paginate all list endpoints — never return unbounded arrays to the client.

```typescript
// ✅ CORRECT — bounded query with index
await this.orderModel
  .find({ userId, status })
  .sort({ createdAt: -1 })
  .limit(limit)
  .skip(skip)
  .lean();

// ❌ WRONG — unbounded
await this.orderModel.find({ userId }).lean();
```

### Aggregation Pipeline Efficiency
- `$match` and `$sort` on indexed fields must always be the first stages.
- `$lookup` stages must use `pipeline` form with a `$match` on the join key to avoid full collection scans.
- Avoid `$unwind` on large arrays without a preceding `$match` that reduces the dataset.
- Use `$project` to drop unwanted fields early in the pipeline, reducing memory pressure.

### Background Work
- CPU-intensive or long-running work (backup, batch processing, report generation) belongs in Bull/BullMQ queues — never block the request thread.
- Cron jobs run as separate Render `cron` services (defined in `render.yaml`) — not via `setInterval` in the app process.

### Connection Pooling
- Mongoose connection pool is shared — do not create new connections per request.
- Redis `ioredis` client is a singleton injected via `RedisModule` — do not create new `Redis()` instances inside services.
- Keep S3 client (`S3Client`) as a module-level singleton.

### Payload Size
- API responses must not include deeply nested populated documents beyond 2 levels.
- Large data sets (exports, reports) must be streamed or paginated — never loaded fully into memory.
- Images and files are served from S3 URLs — never base64-encode binary in API responses.

---

## 19. Operational Excellence

### Environment Parity
- dev, qa, and production environments are structurally identical (same services, same schema, same migrations).
- Code that behaves differently per environment must branch on `process.env.NODE_ENV` — never on hardcoded hostnames or magic strings.
- All three environments are kept in sync via `git merge main → qa → dev` after every production release.

### Database Migrations
- Schema changes that add indexes, rename fields, or transform data must be delivered as a `migrate-mongo` migration script in `migrations/`.
- Migrations are applied automatically on deployment via the `prestart` script.
- Migrations are tracked in the `changelog` collection — never modify an already-applied migration file.
- Migration scripts must be idempotent — safe to run twice without error.

```javascript
// ✅ CORRECT — idempotent migration
async up(db) {
  const exists = await db.collection('users').indexExists('mobile_1');
  if (!exists) {
    await db.collection('users').createIndex({ mobile: 1 }, { unique: true });
  }
}
```

### Observability
- Use structured logging (Winston) — every log entry is a parseable object, not a concatenated string.
- Log at the correct level:
  - `error` — unexpected failures that need human attention
  - `warn` — expected edge cases (rate limit, invalid input caught early)
  - `info` — significant business events (order created, payment verified)
  - `debug` — detailed trace, enabled only in dev
- Every `error` log must include: `{ error: err.message, stack: err.stack }` (in non-production only for `stack`).
- Sentry is integrated in `HttpExceptionFilter` — do not add Sentry calls elsewhere; let the filter handle capture.

### Deployment Safety
- All changes go through the branch flow: `dev → qa → main`.
- No direct commits to `main` for feature work — only hotfixes with immediate backmerge.
- Every deployment is preceded by a `pnpm build` check (TypeScript compilation must pass).
- `autoIndex: false` in production — index creation is done via migrations only, never on startup.
- Health check endpoint (`/health`) must return `200` within 30 seconds for Render to mark the service as live.

### Backup & Recovery
- Daily automated backups run via Render cron jobs (`scripts/backup-database.js`).
- Backups are gzip-compressed, uploaded to S3 with 7-day retention.
- Three separate S3 buckets: `zappy-prod-bucket`, `zappy-qa-bucket`, `zappy-dev-bucket`.
- Recovery procedure must be documented and tested at least quarterly.

### Feature Flags & Safe Rollouts
- New high-risk features must be guarded behind an env var flag (`ENABLE_<FEATURE>=true`).
- The flag defaults to `false` in production until verified in qa.
- Remove the flag after one full release cycle.

### Dependency Management
- Run `pnpm audit` before any release — resolve `high` and `critical` CVEs before deploying to production.
- Pin major versions in `package.json` — allow only minor/patch upgrades without review.
- Do not add a new dependency if the same functionality can be achieved with existing packages or Node.js built-ins.

---

## 20. Code Review Checklist

Before committing any code, verify all applicable items:

**Code Quality**
- [ ] No `console.log` anywhere in the diff
- [ ] No PII in log statements (mobile, email, name, token)
- [ ] All input validated via DTO + `ValidationPipe`
- [ ] No `new Error(...)` — only typed NestJS exceptions
- [ ] No direct cross-module `Model` injection
- [ ] No breaking changes to existing API contracts
- [ ] `pnpm build` passes with zero TypeScript errors
- [ ] No hardcoded strings for roles, statuses, or error codes — use enums

**Security**
- [ ] All new routes have `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(...)`
- [ ] All service methods that access user/vendor data enforce ownership
- [ ] No secrets or credentials in source code
- [ ] User input used in regex is escaped
- [ ] Sensitive fields excluded from API responses
- [ ] New OTP/auth flows have brute-force and rate-limit protection

**Reliability**
- [ ] Multi-collection writes use MongoDB sessions + transactions
- [ ] Redis operations have `try/catch` — failures degrade gracefully
- [ ] Async event listeners have their own `try/catch`
- [ ] External API calls have retry logic with exponential backoff
- [ ] No unbounded `find()` queries — all lists are paginated

**Scalability**
- [ ] New schema fields that are queried have `index: true`
- [ ] Aggregation pipelines start with `$match` on indexed fields
- [ ] No in-process state — shared state in Redis or MongoDB
- [ ] No synchronous blocking work on the request thread

**Operational Excellence**
- [ ] New schema changes delivered via a `migrate-mongo` migration script
- [ ] Migration script is idempotent
- [ ] All three environments will receive the change via backmerge
- [ ] Logs are structured and at the correct level
- [ ] `pnpm audit` shows no new high/critical CVEs

---

## 21. What NOT to Do (Anti-patterns)

| Anti-pattern | Why | Correct approach |
|---|---|---|
| `console.log(user)` | PII leak + not queryable | `logger.info(...)` with masked data |
| `return null` on not-found | Silent failure, confuses callers | `throw new NotFoundException(...)` |
| Business logic in controller | Untestable, leaks concerns | Move to service |
| Direct model access across modules | Tight coupling | Inject the owning service |
| Mutate and `.save()` | Race condition | Use `updateOne` with `$set` |
| Fat service (1000+ lines) | Unmaintainable | Split into sub-services |
| Hardcoded strings for roles/status | Typo-prone, not refactorable | Use enums |
| Skip `@Roles()` on internal endpoints | Security gap | All routes need explicit role declaration |
| `req.user as any` | Loses type safety | Use `AuthUser` type from `src/modules/auth/types/` |
