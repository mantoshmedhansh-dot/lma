# LMA Development Setup Guide

## Prerequisites

### Required Software
- **Node.js** 20.x or later
- **PNPM** 8.x or later (`npm install -g pnpm`)
- **Git** 2.x or later
- **Docker** (optional, for local Supabase)

### Required Accounts
- **Supabase** - [supabase.com](https://supabase.com)
- **Vercel** - [vercel.com](https://vercel.com)
- **Render** - [render.com](https://render.com)
- **Stripe** - [stripe.com](https://stripe.com)
- **Mapbox** or **Google Maps** - For maps and navigation
- **Firebase** - For push notifications

### For Mobile Development
- **Expo CLI** (`npm install -g expo-cli`)
- **EAS CLI** (`npm install -g eas-cli`)
- **Xcode** (macOS only, for iOS development)
- **Android Studio** (for Android development)

## Step-by-Step Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url> LMA
cd LMA

# Install dependencies
pnpm install
```

### 2. Set Up Supabase

#### Option A: Cloud Supabase (Recommended for beginners)

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down:
   - Project URL
   - Anon Key (public)
   - Service Role Key (secret)
3. Go to SQL Editor and run the schema:
   ```sql
   -- Copy and paste contents of packages/database/schema.sql
   ```

#### Option B: Local Supabase (For development)

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Initialize Supabase in project
cd LMA
supabase init

# Start local Supabase
supabase start

# Apply migrations
supabase db push

# Note the local URLs and keys shown in terminal
```

### 3. Configure Environment Variables

Create environment files for each app:

#### Web App (`apps/web/.env.local`)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# API
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1

# Maps
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
# OR
NEXT_PUBLIC_GOOGLE_MAPS_KEY=your_google_maps_key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_pk
```

#### API Server (`packages/api/.env`)
```bash
# Server
PORT=4000
NODE_ENV=development

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_sk
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Firebase (for push notifications)
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email

# Maps
MAPBOX_SECRET_TOKEN=your_mapbox_secret_token
```

#### Mobile App (`apps/mobile/.env`)
```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_API_URL=http://localhost:4000/api/v1
EXPO_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
```

### 4. Set Up External Services

#### Stripe Setup
1. Create account at [stripe.com](https://stripe.com)
2. Get API keys from Dashboard > Developers > API keys
3. Set up webhooks:
   - Endpoint: `https://your-api-url/webhooks/stripe`
   - Events: `payment_intent.succeeded`, `payment_intent.failed`

#### Mapbox Setup
1. Create account at [mapbox.com](https://mapbox.com)
2. Get access token from Account > Tokens
3. For mobile, download offline maps SDK

#### Firebase Setup (Push Notifications)
1. Create project at [Firebase Console](https://console.firebase.google.com)
2. Add iOS and Android apps
3. Download config files:
   - iOS: `GoogleService-Info.plist`
   - Android: `google-services.json`
4. Get service account credentials for backend

### 5. Run Development Servers

```bash
# Terminal 1: Start API server
pnpm dev:api

# Terminal 2: Start web app
pnpm dev:web

# Terminal 3: Start mobile app
pnpm dev:mobile
```

Or run everything together:
```bash
pnpm dev
```

### 6. Verify Setup

1. **API Health Check**: Visit `http://localhost:4000/health`
2. **Web App**: Visit `http://localhost:3000`
3. **Mobile App**: Scan QR code with Expo Go app

## Project Scripts

```bash
# Development
pnpm dev              # Run all apps in development
pnpm dev:web          # Run web app only
pnpm dev:api          # Run API server only
pnpm dev:mobile       # Run mobile app only
pnpm dev:admin        # Run admin dashboard only

# Building
pnpm build            # Build all apps
pnpm build:web        # Build web app
pnpm build:api        # Build API server

# Testing
pnpm test             # Run all tests
pnpm test:unit        # Run unit tests
pnpm test:e2e         # Run e2e tests

# Linting & Formatting
pnpm lint             # Lint all code
pnpm format           # Format all code

# Database
pnpm db:migrate       # Run database migrations
pnpm db:seed          # Seed database with test data
pnpm db:reset         # Reset database

# Type checking
pnpm typecheck        # Check TypeScript types
```

## Folder Structure After Setup

```
LMA/
├── apps/
│   ├── web/                 # Next.js customer web app
│   │   ├── .env.local       # Environment variables
│   │   ├── app/             # App router pages
│   │   ├── components/      # React components
│   │   └── package.json
│   │
│   ├── mobile/              # React Native mobile app
│   │   ├── .env             # Environment variables
│   │   ├── src/             # Source code
│   │   └── app.json         # Expo config
│   │
│   └── admin/               # Admin dashboard
│       └── ...
│
├── packages/
│   ├── api/                 # Express.js backend
│   │   ├── .env             # Environment variables
│   │   ├── src/             # Source code
│   │   └── package.json
│   │
│   ├── database/            # Database schemas
│   │   ├── migrations/
│   │   ├── seeds/
│   │   └── schema.sql
│   │
│   └── shared/              # Shared code
│       └── ...
│
├── docs/                    # Documentation
├── .env.example             # Example environment file
├── package.json             # Root package.json
├── pnpm-workspace.yaml      # PNPM workspace config
└── turbo.json               # Turborepo config
```

## Common Issues & Solutions

### Issue: Supabase connection failing
```bash
# Check if Supabase is running (local)
supabase status

# Verify environment variables
echo $SUPABASE_URL
```

### Issue: Mobile app not connecting to API
- Ensure API URL uses your machine's IP, not `localhost`
- Check if firewall allows port 4000

```bash
# Find your IP
ifconfig | grep "inet " | grep -v 127.0.0.1
# Use: http://YOUR_IP:4000/api/v1
```

### Issue: TypeScript errors
```bash
# Regenerate types from Supabase
supabase gen types typescript --local > packages/shared/types/database.ts
```

### Issue: Dependency conflicts
```bash
# Clear node_modules and reinstall
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
pnpm install
```

## Deployment Checklist

### Before First Deployment

- [ ] All environment variables set in hosting platforms
- [ ] Database schema applied to production Supabase
- [ ] RLS policies configured correctly
- [ ] Stripe webhooks configured for production URL
- [ ] Firebase configured for production
- [ ] Domain and SSL certificates configured
- [ ] Error tracking (Sentry) configured
- [ ] Analytics configured

### Vercel Deployment (Web Apps)

1. Connect repository to Vercel
2. Set root directory to `apps/web` (or `apps/admin`)
3. Add environment variables
4. Deploy

### Render Deployment (API)

1. Connect repository to Render
2. Create new Web Service
3. Set build command: `pnpm install && pnpm build:api`
4. Set start command: `pnpm start:api`
5. Add environment variables
6. Deploy

### Mobile App Deployment

```bash
# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

## Next Steps

After setup is complete:

1. **Explore the codebase** - Understand the project structure
2. **Run tests** - Ensure everything works
3. **Make a small change** - Get familiar with the workflow
4. **Read the docs** - Check `docs/` for more information

## Getting Help

- Check existing documentation in `docs/`
- Review GitHub issues
- Join team Slack/Discord channel
