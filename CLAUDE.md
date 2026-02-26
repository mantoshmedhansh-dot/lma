# LMA - Delivery Hub Operations System (Shipsy-style)

## Project Overview
Delivery Hub Operations System for consumer durable brands — modeled after [Shipsy](https://shipsy.io/last-mile-delivery/).

**Business flow:** Consumer durable brand receives D2C/marketplace orders → Orders arrive at delivery hubs → Hub operator plans routes by vehicle capacity → Assigns routes to drivers → Driver delivers with Google Maps navigation + OTP + photo proof → Failed deliveries return to hub with reasons.

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         VERCEL                              │
│  ┌─────────────┐  ┌──────────────────┐                     │
│  │ Hub Dashboard│  │  Superadmin      │                     │
│  │ (hub ops)   │  │  (multi-hub)     │                     │
│  │  :3000      │  │     :3002        │                     │
│  └──────┬──────┘  └────────┬─────────┘                     │
└─────────┼──────────────────┼──────────────────────────────┘
          │                  │
          ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                        RENDER                               │
│              ┌──────────────────────┐                       │
│              │    FastAPI Backend   │                       │
│              │       :4000          │                       │
│              └──────────┬───────────┘                       │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                       SUPABASE                              │
│  ┌────────────┐ ┌──────┐ ┌─────────┐ ┌──────────────────┐  │
│  │ PostgreSQL │ │ Auth │ │ Storage │ │ Realtime         │  │
│  └────────────┘ └──────┘ └─────────┘ └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Service URLs

### Render
- **Project Dashboard:** https://dashboard.render.com/project/prj-d5vdrsogjchc739820n0
- **API Service:** (to be configured)

### Supabase
- **Project URL:** https://rplvtxuvucafynujdyoy.supabase.co
- **Project ID:** rplvtxuvucafynujdyoy
- **Database Host (pooler):** aws-0-ap-northeast-1.pooler.supabase.com:6543
- **Database Host (direct):** db.rplvtxuvucafynujdyoy.supabase.co:5432
- **Database Password:** (see .env files or auto-memory)
- **Dashboard:** https://supabase.com/dashboard/project/rplvtxuvucafynujdyoy
- **Anon Key:** (see .env files or auto-memory)
- **Service Role Key:** (see .env files or auto-memory)

### Vercel
- **Hub Dashboard:** https://lmafrontend.vercel.app
- **Superadmin:** (to be deployed)

## GitHub Repository
- **URL:** https://github.com/mantoshmedhansh-dot/lma

## Project Structure

```
LMA/
├── apps/
│   ├── web/           → Vercel (Hub Operations Dashboard)
│   ├── superadmin/    → Vercel (Multi-hub Admin Dashboard)
│   ├── driver/        → App Store/Play Store (Driver App)
│   └── mobile/        → App Store/Play Store
│
├── packages/
│   ├── api-python/    → Render (FastAPI backend)
│   ├── api/           → (Legacy Node.js - deprecated)
│   ├── database/      → Supabase (PostgreSQL)
│   ├── shared/        → Shared types/utils
│   └── config/        → Shared configuration
│
├── docs/              → Documentation
├── e2e/               → Playwright tests
└── scripts/           → Build/deployment scripts
```

## Tech Stack

| Layer | Technology | Deployment |
|-------|------------|------------|
| Hub Dashboard | Next.js 14 (App Router) + shadcn | Vercel |
| Driver App | React Native + Expo | App Store / Play Store |
| Backend API | Python 3.11 + FastAPI | Render |
| Database | PostgreSQL | Supabase |
| Real-time | Supabase Realtime | Supabase |
| Authentication | Supabase Auth | Supabase |
| File Storage | Supabase Storage | Supabase |
| Maps | Google Maps | - |
| Push Notifications | Firebase Cloud Messaging | - |

## Development Commands

```bash
# Install dependencies
pnpm install

# Start all dev servers
pnpm dev

# Start individual services
pnpm dev:web        # Hub Dashboard on :3000
pnpm dev:api        # API on :4000

# Build
pnpm build

# Test
pnpm test
pnpm test:e2e
```

## Environment Variables Required

### API (Render)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `API_SECRET`

### Web Apps (Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`

---

# TRANSFORMATION PLAN

## What We Keep (~30%)

| Asset | Path | Reuse |
|-------|------|-------|
| Supabase (DB + Auth + Storage + Realtime) | Infrastructure | As-is |
| FastAPI backend | `packages/api-python/` | Extend with new endpoints |
| Driver app skeleton | `apps/driver/` | Heavily modify screens |
| POD (photo capture + storage) | `apps/driver/app/delivery/` | Extend with OTP |
| Route optimization algorithm | `packages/api/src/services/routeOptimization.ts` | Port to Python |
| SMS/OTP service code | `packages/api/src/services/notifications/` | Port to Python |
| Shared types package | `packages/shared/` | Rewrite for new models |
| shadcn UI components | `apps/web/components/ui/` | Reuse in hub dashboard |
| Auth system | Auth pages + JWT middleware | As-is |
| Vercel + Render deployment | Infrastructure | As-is |

## What We Remove

- All marketplace pages (`apps/web/app/(main)/explore, merchants, cart, checkout, search, favorites, partner, about`)
- Customer-facing web app concept
- Merchant admin (`apps/admin/`) — replaced by hub dashboard
- Product catalog system
- Coupon/discount system
- Wallet system
- Rating/review system
- Shopify/ONDC integrations

---

## Phase 1: Database Schema Changes

### New Tables

```sql
-- 1. Delivery Hubs
CREATE TABLE hubs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  postal_code VARCHAR(10) NOT NULL,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  manager_id UUID REFERENCES users(id),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Hub Vehicles
CREATE TABLE hub_vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hub_id UUID NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  vehicle_type VARCHAR(50) NOT NULL,
  plate_number VARCHAR(20) NOT NULL,
  capacity_kg DECIMAL(8,2),
  capacity_volume_cft DECIMAL(8,2),
  make_model VARCHAR(100),
  status VARCHAR(20) DEFAULT 'available',
  assigned_driver_id UUID REFERENCES drivers(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Order Imports (must come before delivery_orders)
CREATE TABLE order_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hub_id UUID NOT NULL REFERENCES hubs(id),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  source VARCHAR(20) NOT NULL,
  file_url TEXT,
  file_name VARCHAR(255),
  total_records INTEGER DEFAULT 0,
  processed INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  error_log JSONB,
  status VARCHAR(20) DEFAULT 'processing',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 4. Delivery Routes (must come before delivery_orders)
CREATE TABLE delivery_routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hub_id UUID NOT NULL REFERENCES hubs(id),
  route_name VARCHAR(100),
  vehicle_id UUID REFERENCES hub_vehicles(id),
  driver_id UUID REFERENCES drivers(id),
  route_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'planned',
  total_stops INTEGER DEFAULT 0,
  total_distance_km DECIMAL(8,2),
  estimated_duration_mins INTEGER,
  total_weight_kg DECIMAL(8,2),
  total_volume_cft DECIMAL(8,2),
  optimized_polyline TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Delivery Orders
CREATE TABLE delivery_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hub_id UUID NOT NULL REFERENCES hubs(id),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  source VARCHAR(20) NOT NULL,
  import_batch_id UUID REFERENCES order_imports(id),
  seller_name VARCHAR(255),
  seller_order_ref VARCHAR(100),
  marketplace VARCHAR(50),
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_alt_phone VARCHAR(20),
  customer_email VARCHAR(255),
  delivery_address TEXT NOT NULL,
  delivery_city VARCHAR(100),
  delivery_state VARCHAR(100),
  delivery_postal_code VARCHAR(10),
  delivery_latitude DECIMAL(10,8),
  delivery_longitude DECIMAL(11,8),
  product_description TEXT NOT NULL,
  product_sku VARCHAR(100),
  product_category VARCHAR(100),
  package_count INTEGER DEFAULT 1,
  total_weight_kg DECIMAL(8,2),
  total_volume_cft DECIMAL(8,2),
  is_cod BOOLEAN DEFAULT false,
  cod_amount DECIMAL(10,2) DEFAULT 0,
  declared_value DECIMAL(10,2),
  status VARCHAR(30) DEFAULT 'pending',
  priority VARCHAR(10) DEFAULT 'normal',
  route_id UUID REFERENCES delivery_routes(id),
  driver_id UUID REFERENCES drivers(id),
  scheduled_date DATE,
  delivery_slot VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  out_for_delivery_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Route Stops
CREATE TABLE route_stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID NOT NULL REFERENCES delivery_routes(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES delivery_orders(id),
  sequence INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  planned_eta TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  actual_departure TIMESTAMPTZ,
  distance_from_prev_km DECIMAL(8,2),
  duration_from_prev_mins INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Delivery Attempts
CREATE TABLE delivery_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES delivery_orders(id),
  route_stop_id UUID REFERENCES route_stops(id),
  driver_id UUID NOT NULL REFERENCES drivers(id),
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL,
  delivery_otp VARCHAR(6),
  return_otp VARCHAR(6),
  otp_verified BOOLEAN DEFAULT false,
  otp_sent_at TIMESTAMPTZ,
  otp_verified_at TIMESTAMPTZ,
  failure_reason VARCHAR(50),
  failure_notes TEXT,
  photo_urls TEXT[],
  signature_url TEXT,
  recipient_name VARCHAR(255),
  cod_collected BOOLEAN DEFAULT false,
  cod_amount DECIMAL(10,2),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. OTP Tokens
CREATE TABLE otp_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES delivery_orders(id),
  otp_code VARCHAR(6) NOT NULL,
  otp_type VARCHAR(20) NOT NULL,
  sent_to VARCHAR(20) NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Modify existing tables
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS hub_id UUID REFERENCES hubs(id);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS daily_capacity_orders INTEGER DEFAULT 20;
```

### RLS Policies
- Hub managers see only their hub's data
- Drivers see only their assigned routes/orders
- Admins see all hubs

---

## Phase 2: FastAPI Endpoints

All new endpoints go in `packages/api-python/app/routers/`.

### Hub Management (`hubs.py`)
- POST/GET/PATCH /api/v1/hubs
- GET /api/v1/hubs/{hub_id}/stats

### Order Ingestion (`hub_orders.py`)
- POST /api/v1/hub-orders/upload-csv
- POST /api/v1/hub-orders/api-import
- POST/GET/PATCH/DELETE /api/v1/hub-orders
- GET /api/v1/hub-orders/imports

### Route Planning (`hub_routes.py`)
- POST /api/v1/routes/auto-plan
- POST/GET/PATCH/DELETE /api/v1/routes
- POST /api/v1/routes/{id}/assign
- POST /api/v1/routes/{id}/dispatch
- POST /api/v1/routes/{id}/optimize

### Fleet Management (`fleet.py`)
- CRUD /api/v1/fleet/vehicles
- GET /api/v1/fleet/drivers

### Delivery & OTP (`delivery.py`)
- POST /api/v1/delivery/otp/send & verify
- POST /api/v1/delivery/attempt
- GET /api/v1/delivery/my-route
- POST /api/v1/delivery/stop/{id}/arrive & complete

### Analytics (`hub_analytics.py`)
- GET /api/v1/analytics/hub/{hub_id}/dashboard & daily
- GET /api/v1/analytics/overview

---

## Phase 3: Hub Dashboard (Replace `apps/web/`)

```
apps/web/app/
├── (auth)/login/page.tsx
├── (dashboard)/
│   ├── layout.tsx (sidebar + header)
│   ├── page.tsx (redirect to /orders)
│   ├── orders/page.tsx, [id]/page.tsx, import/page.tsx
│   ├── routes/page.tsx, plan/page.tsx, [id]/page.tsx
│   ├── fleet/page.tsx, drivers/page.tsx
│   ├── tracking/page.tsx
│   ├── reports/page.tsx
│   └── settings/page.tsx
```

## Phase 4: Driver App Changes
- Home → "My Route Today" with stops
- Active Delivery → stop-by-stop with OTP flow
- Route Progress tab

## Phase 5: Admin Dashboard (superadmin)
- All Hubs overview, Hub Detail, Cross-hub reports

---

## Implementation Order (Build Sequence)

### Sprint 1 (Week 1-2): Foundation
1. Run database migrations (new tables)
2. Hub CRUD API endpoints
3. Manual order creation API
4. Basic hub dashboard layout + login
5. Orders list page

### Sprint 2 (Week 3-4): Order Ingestion + Route Planning
6. CSV upload + parsing API
7. Import orders page
8. Route planning API (auto-plan with optimization)
9. Route planning page (UI)
10. Route assignment (vehicle + driver)

### Sprint 3 (Week 5-6): Driver App + OTP
11. Driver app route view (multi-stop)
12. Google Maps navigation deeplink
13. OTP generation + SMS sending
14. OTP verification flow (delivery + return)
15. Photo proof capture (extend existing POD)
16. Failed delivery workflow + reasons

### Sprint 4 (Week 7-8): Tracking + Analytics + Polish
17. Live tracking page
18. Reports/analytics page
19. Fleet management page
20. Admin multi-hub dashboard
21. Testing + bug fixes + deployment
