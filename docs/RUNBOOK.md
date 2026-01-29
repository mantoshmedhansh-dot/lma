# LMA Operations Runbook

This runbook contains procedures for common operational tasks and incident response.

## Table of Contents

1. [Service Overview](#service-overview)
2. [Common Tasks](#common-tasks)
3. [Incident Response](#incident-response)
4. [Troubleshooting](#troubleshooting)
5. [Escalation](#escalation)

---

## Service Overview

### Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Vercel    │     │   Render    │     │  Supabase   │
│  (Web Apps) │────▶│   (API)     │────▶│ (Database)  │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Service Endpoints

| Service | Production URL | Staging URL |
|---------|----------------|-------------|
| Customer Web | https://www.lma.com | https://staging.lma.com |
| Merchant Admin | https://merchant.lma.com | https://merchant-staging.lma.com |
| Super Admin | https://admin.lma.com | https://admin-staging.lma.com |
| API | https://api.lma.com | https://api-staging.lma.com |

### Health Check URLs

- API: `GET /health`
- API Liveness: `GET /health/live`
- API Readiness: `GET /health/ready`
- API Metrics: `GET /health/metrics`

---

## Common Tasks

### Deploying to Production

#### API (Render)

```bash
# Option 1: Manual deploy via GitHub Actions
gh workflow run deploy-api.yml -f environment=production

# Option 2: Via Render Dashboard
# 1. Go to https://dashboard.render.com
# 2. Select lma-api-production
# 3. Click "Manual Deploy" → Select commit
```

#### Web Apps (Vercel)

```bash
# Deploy all apps
gh workflow run deploy-web.yml -f app=all -f environment=production

# Deploy specific app
gh workflow run deploy-web.yml -f app=web -f environment=production
```

### Rolling Back a Deployment

#### API (Render)

1. Go to Render Dashboard → Service → Deploys
2. Find the last working deployment
3. Click the "..." menu → "Rollback to this deploy"

#### Web Apps (Vercel)

1. Go to Vercel Dashboard → Project → Deployments
2. Find the last working deployment
3. Click "..." → "Promote to Production"

### Scaling Services

#### API (Render)

```bash
# Render auto-scales on Pro plans
# For manual scaling:
# 1. Go to Render Dashboard
# 2. Select service → Settings
# 3. Adjust instance count
```

### Database Operations

#### Running Migrations

```bash
# Connect to production
supabase link --project-ref <project-id>

# Run migrations
supabase db push
```

#### Creating a Database Backup

```bash
# Supabase automatic daily backups
# For manual backup:
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

---

## Incident Response

### Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| SEV1 | Complete outage | 15 minutes | API down, database unreachable |
| SEV2 | Major degradation | 30 minutes | Slow response times, partial outage |
| SEV3 | Minor issue | 2 hours | Non-critical feature broken |
| SEV4 | Cosmetic/Minor | Next business day | UI bugs, documentation |

### Incident Response Procedure

1. **Acknowledge** - Acknowledge the incident
2. **Assess** - Determine severity and impact
3. **Communicate** - Update status page and stakeholders
4. **Mitigate** - Take immediate action to reduce impact
5. **Resolve** - Fix the root cause
6. **Post-mortem** - Document and learn

### SEV1: Complete API Outage

```
1. CHECK: Verify outage via health endpoint
   curl -I https://api.lma.com/health

2. CHECK: Render service status
   - Dashboard: https://dashboard.render.com
   - Status: https://status.render.com

3. CHECK: Supabase status
   - Dashboard: https://app.supabase.com
   - Status: https://status.supabase.com

4. IF API is down but Render shows healthy:
   - Check environment variables
   - Review recent deployments
   - Check Sentry for errors

5. IF Database is unreachable:
   - Check Supabase connection pool
   - Verify database isn't paused
   - Check for connection limit exhaustion

6. MITIGATE: If needed, rollback to last working deploy

7. COMMUNICATE: Update status page
```

### SEV1: Database Connection Issues

```
1. CHECK: Database connectivity
   curl https://api.lma.com/health

2. CHECK: Connection pool status in Supabase dashboard

3. IF connection pool exhausted:
   - Restart API service to release connections
   - Check for connection leaks in recent code changes

4. IF database is paused (free tier):
   - Supabase Dashboard → Database → Resume

5. IF queries are slow:
   - Check Supabase Dashboard → SQL Editor → Query Performance
   - Look for missing indexes
```

### SEV2: High Error Rate

```
1. CHECK: Sentry for recent errors
   - Look for new error patterns
   - Check error frequency

2. CHECK: API metrics
   curl https://api.lma.com/health/metrics

3. IF specific endpoint failing:
   - Review recent changes to that endpoint
   - Check for external service issues (Stripe, etc.)

4. IF general slowness:
   - Check database query performance
   - Review Render metrics for CPU/memory

5. MITIGATE: Consider rate limiting affected endpoints
```

---

## Troubleshooting

### API Returns 503

**Symptoms:** API health check returns 503, users see "Service Unavailable"

**Diagnosis:**
```bash
# Check health details
curl https://api.lma.com/health | jq

# Check Render service logs
# Render Dashboard → Service → Logs
```

**Common Causes:**
1. Database connection issues → Check Supabase
2. Memory exhaustion → Restart service
3. Deployment in progress → Wait for completion

### High Memory Usage

**Symptoms:** Slow responses, eventual crashes

**Diagnosis:**
```bash
# Check memory metrics
curl https://api.lma.com/health/metrics | jq '.memory'
```

**Resolution:**
1. Restart service if critical
2. Check for memory leaks in recent code
3. Consider increasing instance size

### Slow Database Queries

**Symptoms:** API responses > 2 seconds

**Diagnosis:**
1. Check Supabase Dashboard → Database → Query Performance
2. Look for queries without indexes
3. Check for N+1 query patterns

**Resolution:**
1. Add missing indexes
2. Optimize queries
3. Add caching layer if needed

### Authentication Issues

**Symptoms:** Users can't login, 401 errors

**Diagnosis:**
1. Check Supabase Auth logs
2. Verify JWT secrets match between API and apps
3. Check for expired service role key

**Resolution:**
1. Verify environment variables
2. Rotate keys if compromised
3. Clear browser cookies for affected users

---

## Escalation

### On-Call Rotation

| Role | Primary | Secondary |
|------|---------|-----------|
| Backend | @backend-oncall | @backend-lead |
| Frontend | @frontend-oncall | @frontend-lead |
| Infrastructure | @infra-oncall | @infra-lead |

### Escalation Path

1. **L1:** On-call engineer
2. **L2:** Team lead
3. **L3:** Engineering manager
4. **L4:** CTO

### Contact Information

- **Slack:** #incidents
- **PagerDuty:** lma-production
- **Email:** oncall@lma.com

### External Support

| Service | Support URL |
|---------|-------------|
| Render | https://render.com/support |
| Vercel | https://vercel.com/support |
| Supabase | https://supabase.com/support |
| Stripe | https://support.stripe.com |

---

## Appendix

### Useful Commands

```bash
# Check API health
curl -s https://api.lma.com/health | jq

# Get API metrics
curl -s https://api.lma.com/health/metrics | jq

# Check recent deploys (GitHub)
gh run list --workflow=deploy-api.yml --limit=5

# View API logs (Render CLI)
render logs --tail lma-api-production
```

### Environment Variables Reference

See `.env.example` for complete list.

### Related Documentation

- [Deployment Guide](../DEPLOYMENT.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [API Documentation](./API.md)
