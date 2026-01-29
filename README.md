# LMA - Last Mile Delivery Application

A comprehensive, enterprise-grade last-mile delivery platform built for scale.

## Tech Stack

| Layer | Technology | Deployment |
|-------|------------|------------|
| Web Frontend | Next.js 14 (App Router) | Vercel |
| Mobile App | React Native + Expo | App Store / Play Store |
| Backend API | Node.js + Express | Render |
| Database | PostgreSQL | Supabase |
| Real-time | Supabase Realtime | Supabase |
| Authentication | Supabase Auth | Supabase |
| File Storage | Supabase Storage | Supabase |
| Maps & Navigation | Mapbox / Google Maps | - |
| Payments | Stripe | - |
| Push Notifications | Firebase Cloud Messaging | - |

## Project Structure

```
LMA/
├── apps/
│   ├── web/                 # Next.js web application (Vercel)
│   │   ├── app/             # App router pages
│   │   ├── components/      # React components
│   │   ├── lib/             # Utilities and helpers
│   │   └── public/          # Static assets
│   │
│   ├── mobile/              # React Native mobile app
│   │   ├── src/
│   │   │   ├── screens/     # App screens
│   │   │   ├── components/  # Reusable components
│   │   │   ├── navigation/  # Navigation config
│   │   │   └── services/    # API services
│   │   └── app.json
│   │
│   └── admin/               # Admin dashboard (Next.js on Vercel)
│       ├── app/
│       ├── components/
│       └── lib/
│
├── packages/
│   ├── api/                 # Express.js backend (Render)
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── middleware/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── utils/
│   │   └── package.json
│   │
│   ├── database/            # Database schemas and migrations
│   │   ├── migrations/
│   │   ├── seeds/
│   │   └── schema.sql
│   │
│   ├── shared/              # Shared types, constants, utilities
│   │   ├── types/
│   │   ├── constants/
│   │   └── utils/
│   │
│   └── config/              # Shared configuration
│       └── index.ts
│
├── docs/                    # Documentation
│   ├── api/
│   ├── architecture/
│   └── deployment/
│
├── scripts/                 # Build and deployment scripts
├── .github/                 # GitHub Actions CI/CD
├── turbo.json              # Turborepo config
├── package.json            # Root package.json
└── pnpm-workspace.yaml     # PNPM workspace config
```

## Applications

### 1. Customer Web App
- Browse restaurants/stores
- Place orders
- Real-time order tracking
- Payment processing
- Order history
- Reviews and ratings

### 2. Customer Mobile App
- All web features optimized for mobile
- Push notifications
- Location-based services
- Biometric authentication

### 3. Driver/Rider App (Mobile)
- Accept/reject deliveries
- Navigation integration
- Earnings dashboard
- Delivery history
- Real-time location sharing

### 4. Merchant Dashboard
- Menu/inventory management
- Order management
- Analytics and reports
- Payout tracking

### 5. Admin Dashboard
- User management
- Order oversight
- Analytics and metrics
- System configuration
- Support tools

## Getting Started

See [docs/SETUP.md](docs/SETUP.md) for detailed setup instructions.
