# Incident Response Procedure

## Overview

This document outlines the incident response procedure for LMA production systems.

## Incident Severity Levels

| Level | Definition | Response Time | Examples |
|-------|------------|---------------|----------|
| **SEV1** | Complete service outage affecting all users | < 15 min | API down, database unreachable, payment processing failed |
| **SEV2** | Major feature broken, significant user impact | < 30 min | Order creation failing, authentication issues, slow responses |
| **SEV3** | Minor feature broken, limited user impact | < 2 hours | Non-critical UI bugs, specific edge cases |
| **SEV4** | Cosmetic issues, no functional impact | Next business day | Typos, minor styling issues |

## Roles and Responsibilities

### Incident Commander (IC)
- Coordinates response efforts
- Makes decisions on escalation and communication
- Ensures timeline is documented
- Runs post-incident review

### Technical Lead
- Leads technical investigation
- Coordinates with engineers on fixes
- Validates fixes before deployment

### Communications Lead
- Updates status page
- Notifies stakeholders
- Handles customer communication

## Incident Response Steps

### 1. Detection & Alert

**Automated Detection:**
- Health check failures → GitHub Actions alert
- Error rate spike → Sentry alert
- Latency increase → Monitoring alert

**Manual Detection:**
- Customer reports
- Team member observation

### 2. Acknowledge & Assess

```
Time: T+0
Actions:
1. Acknowledge the incident in Slack #incidents
2. Assess severity level
3. Assign Incident Commander
4. Create incident channel if SEV1/SEV2
```

**Assessment Questions:**
- How many users are affected?
- What functionality is broken?
- When did it start?
- Were there recent deployments?

### 3. Communicate

**Internal Communication:**
```
Template:
🚨 INCIDENT: [Brief description]
Severity: SEV[1-4]
Status: Investigating
IC: @[name]
Impact: [description of user impact]
Updates: #incident-[id]
```

**External Communication (SEV1/SEV2):**
- Update status page
- Prepare customer notification if needed

### 4. Investigate

**Initial Investigation Checklist:**
- [ ] Check health endpoints
- [ ] Review Sentry for new errors
- [ ] Check recent deployments
- [ ] Review infrastructure metrics
- [ ] Check external service status (Supabase, Stripe, etc.)

**Commands for Investigation:**
```bash
# Check API health
curl -s https://api.lma.com/health | jq

# Check metrics
curl -s https://api.lma.com/health/metrics | jq

# Check recent deployments
gh run list --workflow=deploy-api.yml --limit=5
```

### 5. Mitigate

**Quick Mitigation Options:**
1. **Rollback** - Revert to last known good deployment
2. **Feature Flag** - Disable problematic feature
3. **Scale Up** - Increase resources
4. **Rate Limit** - Reduce load
5. **Failover** - Switch to backup service

### 6. Resolve

**Resolution Steps:**
1. Identify root cause
2. Implement fix
3. Test in staging
4. Deploy to production
5. Verify fix in production
6. Monitor for 30 minutes

### 7. Post-Incident

**Immediate (within 24 hours):**
- Document timeline
- Notify stakeholders of resolution
- Update status page

**Post-Incident Review (within 1 week):**
- Schedule review meeting
- Complete post-mortem document
- Identify action items

## Post-Mortem Template

```markdown
# Incident Post-Mortem: [Title]

## Summary
- **Date:** YYYY-MM-DD
- **Duration:** X hours Y minutes
- **Severity:** SEV[1-4]
- **Impact:** [Description of user impact]

## Timeline
| Time (UTC) | Event |
|------------|-------|
| HH:MM | [Event description] |

## Root Cause
[Detailed explanation of what caused the incident]

## Resolution
[What was done to resolve the incident]

## What Went Well
- [List of things that worked]

## What Could Be Improved
- [List of improvements]

## Action Items
| Action | Owner | Due Date |
|--------|-------|----------|
| [Action] | @name | YYYY-MM-DD |

## Lessons Learned
[Key takeaways from this incident]
```

## Communication Templates

### Status Page - Investigating
```
We are currently investigating reports of [issue description].
Some users may experience [impact].
We will provide updates as we learn more.
```

### Status Page - Identified
```
We have identified the cause of [issue].
We are working on a fix and expect to resolve this within [timeframe].
We apologize for any inconvenience.
```

### Status Page - Resolved
```
The issue affecting [service] has been resolved.
All services are now operating normally.
We apologize for any inconvenience caused.
```

### Customer Email (Major Incident)
```
Subject: [Service] Incident - [Date]

Dear Customer,

We experienced an incident on [date] that affected [description].

**What happened:**
[Brief, non-technical explanation]

**Impact:**
[What users experienced]

**What we're doing:**
[Steps taken to prevent recurrence]

We sincerely apologize for any inconvenience this may have caused.

If you have any questions, please contact support@lma.com.

Regards,
The LMA Team
```

## Escalation Matrix

| Severity | Initial Response | Escalation 1 (30 min) | Escalation 2 (1 hour) |
|----------|------------------|----------------------|----------------------|
| SEV1 | On-call engineer | Team Lead + EM | CTO |
| SEV2 | On-call engineer | Team Lead | EM |
| SEV3 | On-call engineer | - | Team Lead |
| SEV4 | Next available | - | - |

## On-Call Rotation

- Primary on-call responds first
- Secondary on-call assists with SEV1/SEV2
- On-call rotates weekly
- Schedule in PagerDuty/Opsgenie

## Emergency Contacts

| Role | Contact |
|------|---------|
| On-call | PagerDuty: lma-production |
| Engineering Manager | @em-handle |
| CTO | @cto-handle |
| Supabase Support | support@supabase.com |
| Render Support | support@render.com |
| Vercel Support | support@vercel.com |
