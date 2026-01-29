# LMA Deployment Guide

This guide explains how to deploy the LMA (Last Mile Delivery Application) platform.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         LMA Platform                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Customer   │  │  Merchant   │  │   Admin     │             │
│  │  Web App    │  │   Admin     │  │  Dashboard  │             │
│  │  (Vercel)   │  │  (Vercel)   │  │  (Vercel)   │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          │                                       │
│                          ▼                                       │
│                   ┌─────────────┐                                │
│                   │  API Server │                                │
│                   │  (Render)   │                                │
│                   └──────┬──────┘                                │
│                          │                                       │
│                          ▼                                       │
│                   ┌─────────────┐                                │
│                   │  Supabase   │                                │
│                   │ (PostgreSQL)│                                │
│                   └─────────────┘                                │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐                               │
│  │   Driver    │  │  Customer   │                               │
│  │ Mobile App  │  │ Mobile App  │                               │
│  │  (Expo/EAS) │  │  (Expo/EAS) │                               │
│  └─────────────┘  └─────────────┘                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Deployment Targets

| Application | Platform | URL Pattern |
|-------------|----------|-------------|
| API | Render | api.yourdomain.com |
| Customer Web | Vercel | www.yourdomain.com |
| Merchant Admin | Vercel | merchant.yourdomain.com |
| Super Admin | Vercel | admin.yourdomain.com |
| Driver App | Expo/App Store | - |
| Customer App | Expo/App Store | - |

## Prerequisites

1. **Accounts Required:**
   - GitHub account
   - Vercel account
   - Render account
   - Supabase account
   - Stripe account (for payments)
   - Expo account (for mobile apps)

2. **CLI Tools:**
   - Node.js 20+
   - pnpm 8+
   - Vercel CLI
   - Render CLI (optional)
   - Expo CLI

## Initial Setup

### 1. Clone and Install

```bash
git clone https://github.com/your-org/lma.git
cd lma
pnpm install
```

### 2. Configure Supabase

1. Create a new Supabase project
2. Run database migrations:
   ```bash
   pnpm db:migrate
   ```
3. Seed initial data:
   ```bash
   pnpm db:seed
   ```
4. Copy Supabase credentials to `.env`

### 3. Configure Environment Variables

```bash
cp .env.example .env
# Edit .env with your values
```

### 4. Configure GitHub Secrets

See [.github/SECRETS.md](.github/SECRETS.md) for detailed instructions.

## Deployment Methods

### Automatic Deployments (CI/CD)

The project includes GitHub Actions workflows for automatic deployments:

1. **Push to `develop`** → Deploy to staging
2. **Push to `main`** → Deploy to production (with manual approval)

### Manual Deployments

#### API (Render)

```bash
# Deploy staging
gh workflow run deploy-api.yml -f environment=staging

# Deploy production
gh workflow run deploy-api.yml -f environment=production
```

Or use Render Dashboard directly.

#### Web Apps (Vercel)

```bash
# Deploy all apps
gh workflow run deploy-web.yml -f app=all -f environment=production

# Deploy specific app
gh workflow run deploy-web.yml -f app=web -f environment=production
```

Or use Vercel CLI:

```bash
cd apps/web
vercel --prod
```

### Docker Deployment

For self-hosted deployments:

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## Environment Configuration

### Staging Environment

- Automatic deployments on `develop` branch
- Uses staging Supabase project
- Lower rate limits
- Debug logging enabled

### Production Environment

- Manual deployments on `main` branch
- Uses production Supabase project
- Higher rate limits
- Minimal logging
- Requires approval for deployment

## Monitoring & Logging

### Health Checks

- API: `GET /health`
- Web Apps: Built-in Next.js health

### Logs

- **Render**: Dashboard → Service → Logs
- **Vercel**: Dashboard → Deployments → Functions

### Metrics

- Render provides basic metrics
- Consider adding DataDog or New Relic for advanced monitoring

## Rollback Procedures

### API (Render)

1. Go to Render Dashboard
2. Select the service
3. Navigate to "Deploys"
4. Click "Manual Deploy" on a previous commit

### Web Apps (Vercel)

1. Go to Vercel Dashboard
2. Select the project
3. Navigate to "Deployments"
4. Click "..." → "Promote to Production" on previous deployment

## Troubleshooting

### Build Failures

1. Check build logs for errors
2. Verify all environment variables are set
3. Ensure pnpm-lock.yaml is up to date

### API Not Responding

1. Check Render service health
2. Verify environment variables
3. Check database connectivity

### Web App 500 Errors

1. Check Vercel function logs
2. Verify API URL is correct
3. Check Supabase connectivity

## Security Considerations

1. **Secrets**: Never commit secrets to git
2. **CORS**: Configure allowed origins properly
3. **Rate Limiting**: Enable on API
4. **HTTPS**: Always use HTTPS in production
5. **Auth**: Verify Supabase RLS policies

## Scaling

### API Scaling (Render)

- Upgrade to Pro/Team plan for auto-scaling
- Add more instances manually

### Web App Scaling (Vercel)

- Serverless, scales automatically
- Consider Edge functions for better performance

### Database Scaling (Supabase)

- Upgrade plan as needed
- Consider connection pooling (PgBouncer)
- Add read replicas for heavy read loads
