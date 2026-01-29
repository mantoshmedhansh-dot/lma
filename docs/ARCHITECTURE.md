# LMA System Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
├─────────────────┬─────────────────┬─────────────────┬─────────────────────────┤
│   Customer Web  │  Customer App   │   Driver App    │    Admin Dashboard      │
│   (Next.js)     │  (React Native) │  (React Native) │    (Next.js)            │
│   [Vercel]      │  [App Stores]   │  [App Stores]   │    [Vercel]             │
└────────┬────────┴────────┬────────┴────────┬────────┴────────┬────────────────┘
         │                 │                 │                 │
         └─────────────────┴─────────────────┴─────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CDN / EDGE NETWORK                                 │
│                              (Vercel Edge)                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│         API GATEWAY             │   │      SUPABASE REALTIME          │
│         (Render)                │   │      (WebSocket)                │
│                                 │   │                                 │
│  ┌───────────────────────────┐  │   │  • Order status updates        │
│  │   Express.js Backend      │  │   │  • Driver location tracking    │
│  │                           │  │   │  • Chat messages               │
│  │  • REST API endpoints     │  │   │  • Notifications               │
│  │  • Business logic         │  │   │                                 │
│  │  • Payment processing     │  │   └─────────────────────────────────┘
│  │  • Order management       │  │
│  │  • Driver assignment      │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SUPABASE                                        │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│   PostgreSQL    │   Auth          │   Storage       │   Edge Functions      │
│   Database      │   (JWT)         │   (Files)       │   (Serverless)        │
└─────────────────┴─────────────────┴─────────────────┴───────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                    │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│   Stripe        │   Mapbox/       │   Firebase      │   SendGrid/           │
│   (Payments)    │   Google Maps   │   (Push Notif)  │   Twilio (SMS)        │
└─────────────────┴─────────────────┴─────────────────┴───────────────────────┘
```

## Component Details

### 1. Frontend Applications

#### Customer Web App (Next.js on Vercel)
```
Purpose: Desktop and mobile web experience for customers
Features:
  - Browse merchants and products
  - Place and track orders
  - Manage account and addresses
  - Payment processing
  - Order history and reviews

Deployment: Vercel (automatic from Git)
URL: https://lma.app
```

#### Customer Mobile App (React Native + Expo)
```
Purpose: Native mobile experience for customers
Features:
  - All web features optimized for mobile
  - Push notifications
  - Biometric login
  - Location services
  - Offline support

Deployment: Apple App Store, Google Play Store
Build: Expo EAS Build
```

#### Driver Mobile App (React Native + Expo)
```
Purpose: Delivery management for drivers
Features:
  - Accept/reject deliveries
  - Turn-by-turn navigation
  - Earnings dashboard
  - Real-time location sharing
  - Chat with customers

Deployment: Apple App Store, Google Play Store
Build: Expo EAS Build
```

#### Admin Dashboard (Next.js on Vercel)
```
Purpose: Platform administration
Features:
  - User management
  - Merchant verification
  - Order monitoring
  - Analytics and reports
  - System configuration

Deployment: Vercel (automatic from Git)
URL: https://admin.lma.app
```

### 2. Backend API (Render)

```
Technology: Node.js + Express.js
Deployment: Render Web Service

Structure:
├── src/
│   ├── controllers/    # Request handlers
│   ├── services/       # Business logic
│   ├── middleware/     # Auth, validation, etc.
│   ├── routes/         # API route definitions
│   ├── utils/          # Helper functions
│   └── config/         # Configuration

Key Responsibilities:
  - REST API for all CRUD operations
  - Business logic and validation
  - Order orchestration
  - Driver assignment algorithm
  - Payment processing (Stripe)
  - Push notification dispatch
  - Background jobs (order timeouts, etc.)
```

### 3. Database Layer (Supabase)

```
PostgreSQL with extensions:
  - uuid-ossp (UUID generation)
  - PostGIS (geolocation)
  - pg_trgm (fuzzy search)

Key Features Used:
  - Row Level Security (RLS)
  - Realtime subscriptions
  - Database functions
  - Automatic backups
  - Connection pooling
```

### 4. Real-time System

```
Supabase Realtime Channels:

1. order:{orderId}
   - Order status changes
   - Driver assignment
   - ETA updates

2. driver:{driverId}
   - New delivery requests
   - Order cancellations

3. location:{orderId}
   - Driver real-time position
   - Subscribed by customer

4. chat:{conversationId}
   - Messages between customer and driver
```

## Data Flow Diagrams

### Order Placement Flow
```
Customer                Web/Mobile              API Server              Database
   │                        │                       │                      │
   │  Select items          │                       │                      │
   ├───────────────────────►│                       │                      │
   │                        │   POST /orders        │                      │
   │                        ├──────────────────────►│                      │
   │                        │                       │  Validate cart       │
   │                        │                       ├─────────────────────►│
   │                        │                       │◄─────────────────────┤
   │                        │                       │  Create order        │
   │                        │                       ├─────────────────────►│
   │                        │                       │◄─────────────────────┤
   │                        │   Order created       │                      │
   │                        │◄──────────────────────┤                      │
   │  Show confirmation     │                       │                      │
   │◄───────────────────────┤                       │                      │
   │                        │                       │  Notify merchant     │
   │                        │                       ├─────────────────────►│
```

### Real-time Order Tracking Flow
```
Customer App            Supabase Realtime           Driver App            API Server
     │                        │                         │                      │
     │  Subscribe to          │                         │                      │
     │  order:{orderId}       │                         │                      │
     ├───────────────────────►│                         │                      │
     │                        │                         │                      │
     │                        │                         │  Update location     │
     │                        │                         ├─────────────────────►│
     │                        │                         │                      │
     │                        │◄────────────────────────┼──────────────────────┤
     │  Location update       │   Broadcast location    │                      │
     │◄───────────────────────┤                         │                      │
     │                        │                         │                      │
     │  Update map            │                         │                      │
```

## Deployment Configuration

### Vercel (Web Apps)
```yaml
# vercel.json
{
  "buildCommand": "pnpm turbo build --filter=web",
  "outputDirectory": "apps/web/.next",
  "framework": "nextjs",
  "regions": ["bom1"],  # Mumbai for India
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase_url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase_anon_key",
    "NEXT_PUBLIC_API_URL": "@api_url"
  }
}
```

### Render (API Server)
```yaml
# render.yaml
services:
  - type: web
    name: lma-api
    env: node
    region: singapore  # Closest to India
    plan: standard
    buildCommand: pnpm install && pnpm build:api
    startCommand: pnpm start:api
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: lma-db
          property: connectionString
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_KEY
        sync: false
```

### Supabase Configuration
```
Project Settings:
  - Region: ap-south-1 (Mumbai)
  - Database: PostgreSQL 15
  - Plan: Pro (for production)

Features to Enable:
  - Realtime
  - Storage
  - Edge Functions
  - Database Webhooks
```

## Security Architecture

### Authentication Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │    │  Supabase   │    │  API Server │
│             │    │    Auth     │    │             │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       │  Login request   │                  │
       ├─────────────────►│                  │
       │                  │                  │
       │  JWT Token       │                  │
       │◄─────────────────┤                  │
       │                  │                  │
       │  API request + JWT                  │
       ├─────────────────────────────────────►
       │                  │                  │
       │                  │  Verify JWT      │
       │                  │◄─────────────────┤
       │                  │                  │
       │                  │  Token valid     │
       │                  ├─────────────────►│
       │                  │                  │
       │  Response                           │
       │◄────────────────────────────────────┤
```

### API Security Layers
```
1. Rate Limiting (express-rate-limit)
   - 100 requests/minute for authenticated users
   - 20 requests/minute for unauthenticated

2. Input Validation (Zod)
   - All inputs validated against schemas
   - Sanitization of user content

3. Authentication (Supabase JWT)
   - Verify token on each request
   - Extract user role and permissions

4. Authorization (RBAC)
   - Check user role for route access
   - Resource-level permissions

5. Row Level Security (Supabase RLS)
   - Database-level access control
   - Users can only access their data
```

## Scaling Strategy

### Horizontal Scaling
```
Phase 1 (0-10K orders/day):
  - Single Render instance
  - Supabase Pro plan
  - Vercel Pro plan

Phase 2 (10K-50K orders/day):
  - Multiple Render instances with load balancer
  - Supabase Team plan
  - Redis for caching
  - CDN for static assets

Phase 3 (50K+ orders/day):
  - Kubernetes deployment
  - Database read replicas
  - Microservices architecture
  - Dedicated caching layer
```

### Caching Strategy
```
Level 1: CDN (Vercel Edge)
  - Static assets
  - API responses (where appropriate)

Level 2: Application Cache (Redis)
  - Session data
  - Frequently accessed data
  - Rate limiting counters

Level 3: Database
  - Materialized views
  - Query result caching
```

## Monitoring & Observability

```
┌─────────────────────────────────────────────────────────────────┐
│                        OBSERVABILITY                             │
├─────────────────┬─────────────────┬─────────────────────────────┤
│     Sentry      │    Mixpanel     │      Better Uptime          │
│  (Errors)       │  (Analytics)    │      (Monitoring)           │
├─────────────────┼─────────────────┼─────────────────────────────┤
│  • Error        │  • User events  │  • Uptime checks            │
│    tracking     │  • Funnels      │  • Status page              │
│  • Performance  │  • Retention    │  • Incident                 │
│    monitoring   │  • A/B tests    │    management               │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

## Disaster Recovery

### Backup Strategy
```
Database (Supabase):
  - Automatic daily backups
  - Point-in-time recovery (7 days)
  - Weekly full backup to external storage

File Storage:
  - Replicated across availability zones
  - Regular backup to cold storage

Configuration:
  - Infrastructure as code (Terraform)
  - Environment variables in secure vault
```

### Recovery Procedures
```
1. Database failure:
   - Automatic failover to replica
   - Restore from backup if needed

2. API server failure:
   - Auto-restart via Render
   - Traffic redirect to healthy instances

3. Regional outage:
   - Manual failover to backup region
   - DNS update to new endpoints
```
