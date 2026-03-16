# 🎉 ZappyEventz Backend API

Event management platform backend built with **NestJS**, providing robust APIs for event creation, vendor management, booking processing, and more.

---

## 🌎 Environments & Databases

| Environment | Render Project | Branch | Database | URL |
|-------------|----------------|--------|----------|-----|
| **Development** | zappy-development | `dev` | `ZAPPY_DEV` | `zappy-api-dev.onrender.com` |
| **QA/Staging** | zappy-staging | `qa` | `ZAPPY_QA` | `zappy-api-qa.onrender.com` |
| **Production** | zappy-production | `main` | `ZAPPY` | `zappy-api-prod.onrender.com` |

### Infrastructure Isolation
- **Separate Render Projects**: Each environment runs in its own project for security isolation and independent access control
- **Shared Resources**: Development and QA share a single Redis instance (`zappy-redis-nonprod`) to optimize free-tier usage
- **Production Protection**: Admin-only access, protected branch deployment
- **MongoDB Atlas**: Same cluster, different databases for data isolation

---

## 📦 Getting Started

```bash
npm install
# or
pnpm install
```

---

## 🚀 Running the Application

### Development Environment
```bash
npm run start:dev
# Uses .env.development → ZAPPY_DEV database
```

### QA/Staging Environment
```bash
npm run start:qa
# Uses .env.qa → ZAPPY_QA database
```

### Production Environment
```bash
# Build first
npm run build:prod

# Then start
npm run start:prod
# Uses .env.production → ZAPPY database
```

---

## 🔨 Build Commands

```bash
# Development build
npm run build:dev

# QA build
npm run build:qa

# Production build
npm run build:prod
```

---

## 🔑 Environment Variables

Each environment file (`.env.development`, `.env.qa`, `.env.production`) contains:

### Core Configuration
- `NODE_ENV` - Environment identifier (development/qa/production)
- `PORT` - Server port (default: 3000)

### Database
- `MONGODB_URL` - MongoDB connection string (environment-specific database)

### Authentication
- `JWT_SECRET` - Secret for JWT token signing
- `JWT_EXPIRES_IN` - Token expiration time

### Third-Party Services
- **MSG91**: SMS/WhatsApp notifications (`MSG91_AUTH_KEY`, `MSG91_SENDER_ID`)
- **AWS S3**: File storage (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`)
- **Redis**: Caching and queues (`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`)
- **Razorpay**: Payment processing (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`)
- **Firebase**: Push notifications (Firebase Admin SDK credentials)

### Frontend Integration
- `FRONTEND_URL` - Corresponding frontend URL (e.g., https://qa.zappyeventz.com)

**⚠️ Important**: Never commit `.env.development`, `.env.qa`, or `.env.production` files. Use `.env.example` as a template.

---

## � Deployment on Render

### Architecture Overview

Our infrastructure uses **separate Render projects** for each environment:

```
Render Workspace
├── 📦 zappy-development (Project)
│   ├── zappy-api-dev (Web Service)
│   ├── zappy-backup-dev (Cron Job)
│   └── zappy-common-dev (Environment Group)
│
├── 📦 zappy-staging (Project)
│   ├── zappy-api-qa (Web Service)
│   ├── zappy-backup-qa (Cron Job)
│   └── zappy-common-qa (Environment Group)
│
├── 📦 zappy-production (Project) 🔒 Admin-only
│   ├── zappy-api-prod (Web Service)
│   ├── zappy-backup-prod (Cron Job)
│   ├── zappy-redis-prod (Redis)
│   └── zappy-common-prod (Environment Group)
│
└── 🔴 zappy-redis-nonprod (Shared Redis for dev/qa)
```

**Benefits:**
- ✅ Security isolation between environments
- ✅ Independent access control (production is admin-only)
- ✅ Cost tracking per project
- ✅ Blast radius containment
- ✅ Free-tier optimization (shared Redis for dev/qa)

### Blueprint Deployment

**1. Prerequisites**
- Create 3 Render projects manually:
  - `zappy-development`
  - `zappy-staging`
  - `zappy-production`

**2. Deploy via Blueprint**
- Go to [Render Dashboard](https://dashboard.render.com/)
- Navigate to **Blueprints**
- Connect your GitHub repository
- Render will detect `render.yaml` and create all services
- Click "Manual Sync" to deploy

**3. Services Created**
```
✅ zappy-api-dev      (Free tier, branch: dev)
✅ zappy-api-qa       (Free tier, branch: qa)
✅ zappy-api-prod     (Free tier, branch: main)
✅ zappy-backup-dev   (Cron Job, daily at 2 AM UTC)
✅ zappy-backup-qa    (Cron Job, daily at 2 AM UTC)
✅ zappy-backup-prod  (Cron Job, daily at 2 AM UTC)
✅ zappy-redis-nonprod (Free Redis, shared dev/qa)
✅ zappy-redis-prod    (Free Redis, production only)
```

**3. Configure Environment Variables**

For each service, go to **Settings → Environment** and add:

<details>
<summary><b>📋 Development Environment Variables</b></summary>

```bash
NODE_ENV=development
PORT=3000
MONGODB_URL=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/ZAPPY_DEV
JWT_SECRET=dev_secret_key
JWT_EXPIRES_IN=7d
MSG91_AUTH_KEY=your_dev_key
AWS_ACCESS_KEY_ID=dev_access_key
AWS_SECRET_ACCESS_KEY=dev_secret_key
AWS_REGION=ap-south-1
AWS_S3_BUCKET=zappy-dev-bucket
REDIS_HOST=localhost
REDIS_PORT=6379
FRONTEND_URL=https://dev.zappyeventz.com
```
</details>

<details>
<summary><b>📋 QA Environment Variables</b></summary>

```bash
NODE_ENV=qa
PORT=3000
MONGODB_URL=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/ZAPPY_QA
JWT_SECRET=qa_secret_key
JWT_EXPIRES_IN=1d
MSG91_AUTH_KEY=your_qa_key
MSG91_SENDER_ID=ZAPPYQA
AWS_ACCESS_KEY_ID=qa_access_key
AWS_SECRET_ACCESS_KEY=qa_secret_key
AWS_REGION=ap-south-1
AWS_S3_BUCKET=zappy-qa-bucket
REDIS_HOST=localhost
REDIS_PORT=6379
FRONTEND_URL=https://qa.zappyeventz.com
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=test_secret_xxx
```
</details>

<details>
<summary><b>📋 Production Environment Variables</b></summary>

```bash
NODE_ENV=production
PORT=3000
MONGODB_URL=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/ZAPPY
JWT_SECRET=super_secure_production_secret
JWT_EXPIRES_IN=1d
MSG91_AUTH_KEY=your_prod_key
AWS_ACCESS_KEY_ID=prod_access_key
AWS_SECRET_ACCESS_KEY=prod_secret_key
AWS_REGION=ap-south-1
AWS_S3_BUCKET=zappy-prod-bucket
REDIS_HOST=localhost
REDIS_PORT=6379
FRONTEND_URL=https://zappyeventz.com
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=live_secret_xxx
```
</details>

**4. Deploy**
- Push to respective branches → Auto-deploys
- Monitor logs in Render Dashboard
- Services will be available at:
  - `https://zappy-api-dev.onrender.com`
  - `https://zappy-api-qa.onrender.com`
  - `https://zappy-api-prod.onrender.com`

### ⚠️ Free Tier Limitations

- **Auto-sleep**: Services spin down after 15 minutes of inactivity
- **Cold starts**: 30-60 seconds to wake up
- **750 hours/month**: Shared across all free services
- **No background workers**: BullMQ jobs won't run (upgrade needed)

### 💡 Upgrade Path (When Ready)

```yaml
Development:  Keep Free → Only for testing
QA:           Starter ($7/month) → 24/7 uptime
Production:   Starter+ ($25/month) → Auto-scaling, zero downtime
Redis:        Starter ($7/month) → For BullMQ queues
```

### 🔄 Deployment Workflow

```bash
# Development
git push origin dev
# → Auto-deploys to zappy-api-dev

# QA
git push origin qa
# → Auto-deploys to zappy-api-qa

# Production
git push origin main
# → Auto-deploys to zappy-api-prod
```

### 📊 Monitoring & Logs

- **Live Logs**: Render Dashboard → Service → Logs
- **Metrics**: Dashboard shows CPU, Memory, Response times
- **Alerts**: Configure via Dashboard → Settings → Notifications
- **Rollback**: Dashboard → Deployments → Rollback to previous

### 🔐 Security Features & Best Practices

**Built-in Security:**
- ✅ **Helmet**: Security headers (CSP, HSTS, X-Frame-Options)
- ✅ **Rate Limiting**: 100 requests per 60 seconds per IP
- ✅ **Health Checks**: `/health`, `/readiness`, `/liveness` endpoints
- ✅ **CORS**: Configured per environment
- ✅ **JWT Authentication**: Token-based auth with expiration

**Environment Isolation:**
```bash
# 1. Separate Render projects
Production project = Admin-only access
Development/QA = Team access

# 2. Rotate secrets between environments
JWT_SECRET (different for dev/qa/prod)

# 3. Use test credentials for dev/qa
Razorpay test keys for QA
Production keys only for prod

# 4. Restrict CORS origins
CORS_ORIGIN=https://qa.zappyeventz.com (not *)

# 5. Production protection
Protected branch (main)
Manual approval for production changes
```

### 🆘 Common Issues & Solutions

**Issue: Service not starting**
```bash
Solution: Check logs for missing environment variables
→ Render Dashboard → Service → Logs
```

**Issue: Database connection failed**
```bash
Solution: Whitelist Render IPs in MongoDB Atlas
→ Atlas → Network Access → Add 0.0.0.0/0 (or specific IPs)
```

**Issue: Cold starts too slow**
```bash
Solution: Upgrade to Starter plan ($7/month)
→ Settings → Plan → Select Starter
```

**Issue: Need Redis/Background jobs**
```bash
Solution: Add managed Redis service
→ New → Redis → Connect to your services
→ Update REDIS_HOST env var
```

---

## �🗄️ Database Setup

### MongoDB Atlas Structure
- **Cluster**: `cluster0.kzcleap.mongodb.net`
- **Databases**:
  - `ZAPPY_DEV` → Development
  - `ZAPPY_QA` → QA/Staging
  - `ZAPPY` → Production

### Check Database Connection
```bash
# Check development DB
npm run db:check:dev

# Check QA DB
npm run db:check:qa

# Check production DB
npm run db:check:prod
```

### Database Migrations

Migrations run **automatically** on deployment via Render's `preDeployCommand`.

```bash
# Create a new migration
npm run migrate:create add-indexes

# Check migration status (local)
npm run migrate:status

# Run pending migrations (local testing)
npm run migrate:up
```

📖 **For detailed migration workflow, see [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)**

### Database Backups

Automated backups run daily at 2:00 AM UTC via Render Cron Jobs.

```bash
# Run manual backup (local development)
node scripts/backup-database.js

# Backup specific environment
CHECK_ENV=qa node scripts/backup-database.js
CHECK_ENV=production node scripts/backup-database.js
```

**Prerequisites for local backup:**
- AWS S3 credentials in `.env.local`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`

📖 **For backup configuration and restore procedures, see [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md#backup--recovery)**

---

## 🧱 Architecture & Tech Stack

### Framework & Core
- **NestJS 11** - Progressive Node.js framework
- **TypeScript** - Type-safe development
- **Mongoose** - MongoDB ODM

### Authentication & Security
- **Passport** with JWT strategy
- **Helmet** - Security headers
- **CORS** - Cross-origin configuration
- **Rate limiting** - API throttling

### Infrastructure
- **Redis (ioredis)** - Caching & session management
- **BullMQ** - Background job processing
- **Winston** - Structured logging

### Integrations
- **Firebase Admin** - Push notifications
- **AWS SDK** - S3 file storage
- **Razorpay** - Payment gateway
- **MSG91** - SMS/WhatsApp
- **Nodemailer** - Email service

---

## 📂 Project Structure

```
backend-zappy/
├── src/
│   ├── modules/          # Feature modules (auth, events, vendors, orders, etc.)
│   ├── common/           # Shared utilities (guards, decorators, filters, pipes)
│   ├── config/           # Configuration files (app, database, firebase, queue)
│   ├── providers/        # External service providers
│   ├── services/         # Shared business logic services
│   ├── workers/          # Background job processors
│   └── events/           # Event listeners (email, orders)
├── scripts/              # Utility scripts (DB check, env setup)
├── test/                 # E2E tests
├── render.yaml           # Render deployment config (3 environments)
├── .renderignore         # Files to exclude from deployment
├── .env.example          # Environment template (committed)
├── .env.development      # Dev config (gitignored)
├── .env.qa               # QA config (gitignored)
└── .env.production       # Prod config (gitignored)
```

---

## 🧪 Testing

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# E2E tests
npm run test:e2e

# Coverage report
npm run test:cov
```

---

## 🔍 Development Tools

### Linting & Formatting
```bash
# Run ESLint
npm run lint

# Format code with Prettier
npm run format
```

### Debug Mode
```bash
npm run start:debug
# Runs with Node inspector on port 9229
```

---

## 🚢 Deployment Checklist (Render)

**Before First Deploy:**
- [ ] Push `dev`, `qa`, `main` branches to GitHub
- [ ] Connect repository in Render Dashboard
- [ ] Configure environment variables for all 3 services
- [ ] Whitelist Render IPs in MongoDB Atlas (0.0.0.0/0)
- [ ] Test health endpoints after deployment

**Before Production Deploy:**
- [ ] Test thoroughly on QA environment
- [ ] Rotate all secrets (JWT, API keys)
- [ ] Use production credentials (Razorpay live, AWS prod)
- [ ] Update CORS origins to production frontend
- [ ] Monitor first deployment logs
- [ ] Verify database connections
- [ ] Test critical API endpoints

**Post-Deploy:**
- [ ] Update frontend `NEXT_PUBLIC_API_URL` to Render URLs
- [ ] Test end-to-end flows (auth, payments, notifications)
- [ ] Set up uptime monitoring (UptimeRobot, Pingdom)
- [ ] Configure Slack/email alerts in Render

---

## 🌐 API Documentation

When running locally, Swagger documentation is available at:
```
http://localhost:3000/api/docs
```

On Render:
```
https://zappy-api-dev.onrender.com/api/docs
https://zappy-api-qa.onrender.com/api/docs
https://zappy-api-prod.onrender.com/api/docs
```

---

## 🔧 Common Tasks

### Setup New Environment
```bash
# Copy example file
cp .env.example .env.development

# Edit variables
# Update MONGODB_URL, secrets, API keys, etc.

# Test connection
npm run db:check:dev

# Start server
npm run start:dev
```

### Switch Between Environments
```bash
# Development
npm run start:dev

# QA
npm run start:qa

# Production (after build)
npm run build:prod && npm run start:prod
```

---

## 📊 Monitoring & Logging

- **Winston Logger**: Structured logging to console and files
- **Sentry** (optional): Error tracking and monitoring
- **Log Files**: Stored in `logs/` directory (gitignored)

---

## 👨‍💻 Developer

**Mohammad Tausif**  
- 💼 Developer at [ZappyEventz](https://zappyeventz.com)  
- ✉️ Email: tausif7785@gmail.com
- 🌐 Portfolio: [https://tausif.info](https://tausif.info)
- 💻 GitHub: [https://github.com/tausif40](https://github.com/tausif40)  
- 🔗 LinkedIn: [https://www.linkedin.com/in/muhammad-tausif](https://www.linkedin.com/in/muhammad-tausif)

---

## 📄 License

UNLICENSED - Private project
