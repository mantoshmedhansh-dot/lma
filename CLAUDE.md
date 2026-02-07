# LMA - Last Mile Delivery Application

## Project Overview
Enterprise-grade last-mile delivery platform built for scale.

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         VERCEL                              │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐    │
│  │   Web App   │  │ Admin Panel │  │  Superadmin      │    │
│  │ (customers) │  │ (merchants) │  │  (internal ops)  │    │
│  │  :3000      │  │   :3001     │  │     :3002        │    │
│  └──────┬──────┘  └──────┬──────┘  └────────┬─────────┘    │
└─────────┼────────────────┼──────────────────┼──────────────┘
          │                │                  │
          ▼                ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                        RENDER                               │
│              ┌──────────────────────┐                       │
│              │    Express.js API    │                       │
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
- **Project URL:** https://yqvlbgxhuiuflxfssbix.supabase.co
- **Project ID:** yqvlbgxhuiuflxfssbix
- **Database Host:** db.yqvlbgxhuiuflxfssbix.supabase.co:6543
- **Dashboard:** https://supabase.com/dashboard/project/yqvlbgxhuiuflxfssbix
- **Publishable Key:** sb_publishable_AQQK7g6dsbMBv-PF8pgvZA_VpG9Wd-m
- **Secret Key:** (stored in .env - never commit)

### Vercel
- **Web App:** (to be deployed)
- **Admin Panel:** (to be deployed)
- **Superadmin:** (to be deployed)

## Project Structure

```
LMA/
├── apps/
│   ├── web/           → Vercel (Customer web app)
│   ├── admin/         → Vercel (Merchant dashboard)
│   ├── superadmin/    → Vercel (Admin dashboard)
│   ├── driver/        → App Store/Play Store
│   └── mobile/        → App Store/Play Store
│
├── packages/
│   ├── api-python/    → Render (FastAPI backend) ⭐ NEW
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
| Web Frontend | Next.js 14 (App Router) | Vercel |
| Mobile App | React Native + Expo | App Store / Play Store |
| Backend API | **Python 3.11 + FastAPI** | Render |
| Database | PostgreSQL | Supabase |
| Real-time | Supabase Realtime | Supabase |
| Authentication | Supabase Auth | Supabase |
| File Storage | Supabase Storage | Supabase |
| Maps | Mapbox / Google Maps | - |
| Payments | Stripe | - |
| Push Notifications | Firebase Cloud Messaging | - |

## GitHub Repository
- **URL:** https://github.com/singhmantoshkumar22/lma

## Development Commands

```bash
# Install dependencies
pnpm install

# Start all dev servers
pnpm dev

# Start individual services
pnpm dev:web        # Web app on :3000
pnpm dev:admin      # Admin on :3001
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
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Web Apps (Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
