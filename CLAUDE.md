# LMA - Delivery Hub Operations System

## Project Overview
Delivery Hub Operations System for consumer durable brands — modeled after [Shipsy](https://shipsy.io/last-mile-delivery/).

**Business flow:** Brand receives D2C/marketplace orders → Orders arrive at delivery hubs → Hub operator plans routes by vehicle capacity → Assigns routes to drivers → Driver delivers with Google Maps + OTP + photo proof → Failed deliveries return to hub with reasons.

---

## Deployment Architecture

```
 VERCEL (Frontend)          RENDER (Backend)          SUPABASE (Database)
 ┌──────────────┐          ┌──────────────┐          ┌──────────────────┐
 │ Hub Dashboard│ ───API──▶│  FastAPI API  │ ───DB──▶│ PostgreSQL + Auth│
 │ Next.js 14   │          │  Python 3    │          │ Storage + Realtime│
 └──────────────┘          └──────────────┘          └──────────────────┘
```

---

## Service URLs & IDs

### GitHub
- **Repository:** https://github.com/mantoshmedhansh-dot/lma
- **Default Branch:** `main`
- **Workflows:** Deploy (all), Deploy Web Apps, Deploy API, CI, Production Alerts, Preview

### Vercel
- **Team Name:** Mantosh
- **Team Slug:** ilms
- **Team/Org ID:** `team_OT5CWaqk30ASE3WfEeeAZaQP`
- **Hub Dashboard Project:**
  - **Name:** `lma_frontend`
  - **Project ID:** `prj_YeDHkd7KqxOMl4Tv9AOmtBi0uW4N`
  - **Production URL:** https://lmafrontend.vercel.app
  - **Root Directory:** `apps/web`
- **Deploys:** Vercel Git Integration auto-deploys on push to `main` + GitHub Actions workflow

### Render
- **Service Name:** `lma-api`
- **Plan:** Starter (spins down after inactivity)
- **Service ID:** `srv-d6fesahdrdic739uk8ng`
- **Project Dashboard:** https://dashboard.render.com/web/srv-d6fesahdrdic739uk8ng
- **API URL:** https://lma-api-llq1.onrender.com
- **Git:** Connected to `mantoshmedhansh-dot/lma` branch `main`
- **Root Directory:** `packages/api-python`

### Supabase
- **Project URL:** https://rplvtxuvucafynujdyoy.supabase.co
- **Project ID:** `rplvtxuvucafynujdyoy`
- **Dashboard:** https://supabase.com/dashboard/project/rplvtxuvucafynujdyoy
- **Database Host (pooler):** `aws-0-ap-northeast-1.pooler.supabase.com:6543`
- **Database Host (direct):** `db.rplvtxuvucafynujdyoy.supabase.co:5432`
- **Credentials:** See `packages/api-python/.env` or auto-memory (not stored in repo)

---

## GitHub Secrets (for CI/CD)

| Secret | Value | Used By |
|--------|-------|---------|
| `VERCEL_TOKEN` | Vercel API token | deploy.yml, deploy-web.yml |
| `VERCEL_ORG_ID` | `team_OT5CWaqk30ASE3WfEeeAZaQP` | deploy.yml, deploy-web.yml |
| `VERCEL_WEB_PROJECT_ID` | `prj_YeDHkd7KqxOMl4Tv9AOmtBi0uW4N` | deploy.yml, deploy-web.yml |
| `RENDER_SERVICE_ID` | `srv-d6fesahdrdic739uk8ng` | deploy.yml |
| `RENDER_API_KEY` | (needs to be set) | deploy.yml, deploy-api.yml |

### Secrets Still Needed
- `RENDER_API_KEY` — Get from Render Dashboard → Account Settings → API Keys
- `VERCEL_ADMIN_PROJECT_ID` — For admin app deploy (when ready)
- `VERCEL_SUPERADMIN_PROJECT_ID` — For superadmin app deploy (when ready)

---

## GitHub Actions Workflows

| Workflow | File | Trigger | What It Does |
|----------|------|---------|--------------|
| **Deploy** | `deploy.yml` | Push to `main` | Deploys API to Render + Web to Vercel (production) |
| **Deploy Web Apps** | `deploy-web.yml` | Push to `main` (web paths) | Deploys web/admin/superadmin to Vercel (preview by default) |
| **Deploy API** | `deploy-api.yml` | Push to `main` (api paths) | Deploys API to Render staging/production |
| **CI** | `ci.yml` | Push to `main` | Lint + test |
| **Preview** | `preview.yml` | PRs | Preview deployments |
| **Alerts** | `alerts.yml` | Schedule | Production health checks |

> **Note:** `deploy.yml` and `deploy-web.yml` both trigger on push to main and can overlap. `deploy.yml` goes to production, `deploy-web.yml` goes to preview.

---

## Project Structure

```
LMA/
├── apps/
│   ├── web/              → Vercel (Hub Operations Dashboard)
│   ├── superadmin/       → Vercel (Multi-hub Admin - future)
│   ├── driver/           → App Store/Play Store (Driver App)
│   └── mobile/           → App Store/Play Store
├── packages/
│   ├── api-python/       → Render (FastAPI backend)
│   ├── api/              → (Legacy Node.js - deprecated)
│   ├── database/         → Supabase (PostgreSQL + migrations)
│   ├── shared/           → Shared types/utils
│   └── config/           → Shared configuration
├── .github/workflows/    → CI/CD pipelines
├── docs/                 → Documentation
└── e2e/                  → Playwright tests
```

---

## Tech Stack

| Layer | Technology | Deployment |
|-------|------------|------------|
| Hub Dashboard | Next.js 14 (App Router) + shadcn/ui + Tailwind | Vercel |
| Driver App | React Native + Expo | App Store / Play Store |
| Backend API | Python 3.11 + FastAPI + Pydantic | Render |
| Database | PostgreSQL (8 hub tables + existing) | Supabase |
| Auth | Supabase Auth (JWT + RLS) | Supabase |
| File Storage | Supabase Storage | Supabase |
| Maps | Google Maps | - |

---

## Environment Variables

### API (Render) — `packages/api-python/.env`
```
SUPABASE_URL=https://rplvtxuvucafynujdyoy.supabase.co
SUPABASE_SERVICE_KEY=(service role key)
DATABASE_URL=(connection string)
API_SECRET=lma-api-secret-change-in-production
PORT=4000
CORS_ORIGINS=http://localhost:3000,https://lmafrontend.vercel.app
```

### Web (Vercel) — `apps/web/.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=https://rplvtxuvucafynujdyoy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=(anon key)
NEXT_PUBLIC_API_URL=https://lma-api-llq1.onrender.com
```

---

## Development Commands

```bash
# Install dependencies
pnpm install

# Start dev servers
cd apps/web && pnpm dev                                    # Hub Dashboard on :3000
cd packages/api-python && source venv/bin/activate && uvicorn app.main:app --reload --port 4000  # API on :4000

# Build
cd apps/web && pnpm build

# Deploy (manual)
npx vercel --prod                     # Vercel production deploy
git push origin main                  # Triggers GitHub Actions auto-deploy
```

---

## API Endpoints (FastAPI)

### Hub Management — `/api/v1/hubs`
POST / GET / GET `/{id}` / PATCH `/{id}` / GET `/{id}/stats`

### Orders — `/api/v1/hub-orders`
POST / GET / GET `/{id}` / PATCH `/{id}` / DELETE `/{id}` / POST `/upload-csv` / GET `/imports`

### Routes — `/api/v1/routes`
POST / GET / GET `/{id}` / PATCH `/{id}` / DELETE `/{id}` / POST `/{id}/assign` / POST `/{id}/dispatch` / POST `/auto-plan`

### Fleet — `/api/v1/fleet`
POST `/vehicles` / GET `/vehicles` / PATCH `/vehicles/{id}` / DELETE `/vehicles/{id}` / GET `/drivers`

### Delivery — `/api/v1/delivery`
POST `/otp/send` / POST `/otp/verify` / POST `/attempt` / GET `/my-route` / POST `/stop/{id}/arrive` / POST `/stop/{id}/complete`

### Analytics — `/api/v1/analytics`
GET `/hub/{id}/dashboard` / GET `/hub/{id}/daily` / GET `/overview`

---

## Database Tables (Hub Operations)

Created via `packages/database/migrations/008_hub_operations.sql`:
1. `hubs` — Delivery hub locations
2. `hub_vehicles` — Fleet at each hub
3. `order_imports` — Bulk upload tracking
4. `delivery_routes` — Planned routes
5. `delivery_orders` — Individual delivery orders
6. `route_stops` — Ordered stops within routes
7. `delivery_attempts` — Each delivery try (with OTP + proof)
8. `otp_tokens` — OTP codes for delivery/return verification

Plus: `drivers` table extended with `hub_id` and `daily_capacity_orders` columns.

---

## Dashboard Pages (Next.js App Router)

```
(dashboard)/
├── layout.tsx              — Auth guard + sidebar (hub_manager/admin/super_admin only)
├── orders/page.tsx         — Order list with filters, search, stats
├── orders/[id]/page.tsx    — Order detail + attempt history
├── orders/import/page.tsx  — CSV upload + import history
├── routes/page.tsx         — Route list by date/status
├── routes/plan/page.tsx    — Route planning (auto-plan + manual)
├── routes/[id]/page.tsx    — Route detail with stops
├── fleet/page.tsx          — Vehicle management
├── fleet/drivers/page.tsx  — Driver list
├── tracking/page.tsx       — Live route tracking
├── reports/page.tsx        — KPIs + daily reports
└── settings/page.tsx       — Hub settings editor
```

---

## Remaining Work (Sprints 2-4)

### Sprint 2: Driver App + OTP
- Driver app route view (multi-stop)
- Google Maps navigation deeplink
- OTP generation + SMS sending (Twilio/MSG91)
- OTP verification flow (delivery + return)
- Photo proof capture
- Failed delivery workflow

### Sprint 3: Tracking + Admin
- Live driver tracking on map (Google Maps API)
- Superadmin multi-hub dashboard
- Cross-hub analytics

### Sprint 4: Polish
- Realtime updates (Supabase Realtime)
- Push notifications (FCM)
- Performance optimization
- E2E tests
