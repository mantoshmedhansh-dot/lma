# GitHub Secrets Configuration

This document describes all the secrets and variables that need to be configured in your GitHub repository for CI/CD to work properly.

## Required Secrets

### Supabase
| Secret Name | Description | Where to find |
|-------------|-------------|---------------|
| `SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Supabase Dashboard → Settings → API |

### Vercel (for web app deployments)
| Secret Name | Description | Where to find |
|-------------|-------------|---------------|
| `VERCEL_TOKEN` | Vercel API token | Vercel → Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel organization ID | Vercel → Settings → General |
| `VERCEL_WEB_PROJECT_ID` | Customer web app project ID | Vercel → Project → Settings → General |
| `VERCEL_ADMIN_PROJECT_ID` | Merchant admin project ID | Vercel → Project → Settings → General |
| `VERCEL_SUPERADMIN_PROJECT_ID` | Super admin project ID | Vercel → Project → Settings → General |

### Render (for API deployments)
| Secret Name | Description | Where to find |
|-------------|-------------|---------------|
| `RENDER_API_KEY` | Render API key | Render → Account Settings → API Keys |
| `RENDER_STAGING_SERVICE_ID` | Staging API service ID | Render → Service → Settings |
| `RENDER_PRODUCTION_SERVICE_ID` | Production API service ID | Render → Service → Settings |

### Stripe (optional, for payments)
| Secret Name | Description | Where to find |
|-------------|-------------|---------------|
| `STRIPE_SECRET_KEY` | Stripe secret key | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | Stripe Dashboard → Developers → Webhooks |

### Notifications (optional)
| Secret Name | Description | Where to find |
|-------------|-------------|---------------|
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications | Slack App → Incoming Webhooks |

## Repository Variables

| Variable Name | Description | Example |
|---------------|-------------|---------|
| `TURBO_TEAM` | Turborepo team name | `lma-team` |
| `API_URL` | Production API URL | `https://api.lma.com` |
| `API_STAGING_URL` | Staging API URL | `https://api-staging.lma.com` |
| `API_PRODUCTION_URL` | Production API URL | `https://api.lma.com` |

## Environment-Specific Secrets

For staging and production environments, you may need to create environment-specific secrets:

### Staging Environment
- Create GitHub environment named `staging`
- Add staging-specific overrides if needed

### Production Environment
- Create GitHub environment named `production`
- Enable required reviewers for production deployments
- Add production-specific secrets

## Setup Steps

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Add each secret listed above in the "Repository secrets" section
4. Add variables in the "Repository variables" section
5. For environment-specific secrets, create environments first under Settings → Environments

## Security Best Practices

1. **Never commit secrets** to the repository
2. **Use environment-specific secrets** for staging/production differences
3. **Rotate secrets regularly** (at least every 90 days)
4. **Enable required reviewers** for production deployments
5. **Use branch protection rules** to prevent direct pushes to main
6. **Audit secret access** periodically

## Verifying Secrets

After adding secrets, you can verify they're working by:

1. Triggering a workflow manually
2. Checking the workflow logs for any secret-related errors
3. Ensuring the deployment completes successfully
