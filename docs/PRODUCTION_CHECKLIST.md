# Production Launch Checklist

Use this checklist before launching to production or after making significant changes.

## Pre-Launch Checklist

### Infrastructure

- [ ] All environment variables configured in production
- [ ] SSL/TLS certificates valid and auto-renewing
- [ ] DNS records properly configured
- [ ] CDN caching rules configured
- [ ] Rate limiting enabled and tested
- [ ] Database connection pooling configured
- [ ] Backup strategy verified

### Security

- [ ] All secrets rotated from development
- [ ] Security headers enabled (CSP, HSTS, etc.)
- [ ] CORS configured for production domains only
- [ ] Authentication flows tested
- [ ] Authorization rules verified
- [ ] SQL injection protection enabled
- [ ] XSS protection enabled
- [ ] Supabase RLS policies active

### Monitoring

- [ ] Sentry configured and receiving errors
- [ ] Health check endpoints working
- [ ] Alerting configured (Slack, PagerDuty, etc.)
- [ ] Log aggregation set up
- [ ] Metrics dashboards created
- [ ] Uptime monitoring enabled

### Performance

- [ ] Images optimized
- [ ] JavaScript bundles minimized
- [ ] Database queries optimized
- [ ] Indexes created for common queries
- [ ] Cache headers configured
- [ ] Compression enabled

### Testing

- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Load testing completed
- [ ] Security scanning completed
- [ ] Accessibility audit completed

### Documentation

- [ ] API documentation complete
- [ ] Runbook updated
- [ ] Architecture docs current
- [ ] Environment setup guide complete
- [ ] On-call rotation documented

### Business

- [ ] Terms of Service published
- [ ] Privacy Policy published
- [ ] Cookie consent implemented
- [ ] Support email configured
- [ ] Feedback mechanism in place

---

## Deployment Checklist

### Before Deployment

- [ ] All tests passing in CI
- [ ] Code reviewed and approved
- [ ] Database migrations tested on staging
- [ ] Rollback plan documented
- [ ] Team notified of deployment

### During Deployment

- [ ] Deployment started
- [ ] Monitor deployment progress
- [ ] Verify health checks passing
- [ ] Check error rates in Sentry
- [ ] Verify key user flows working

### After Deployment

- [ ] Smoke tests completed
- [ ] Performance baseline checked
- [ ] No new errors in monitoring
- [ ] Team notified of completion
- [ ] Documentation updated if needed

---

## Rollback Checklist

### Decision Criteria

- [ ] Error rate > 5%
- [ ] P95 latency > 2x baseline
- [ ] Critical functionality broken
- [ ] Security vulnerability discovered

### Rollback Steps

1. [ ] Notify team of rollback decision
2. [ ] Initiate rollback (see Runbook)
3. [ ] Verify previous version deployed
4. [ ] Confirm health checks passing
5. [ ] Monitor for 15 minutes
6. [ ] Notify team of completion
7. [ ] Create incident report

---

## Weekly Maintenance Checklist

- [ ] Review error trends in Sentry
- [ ] Check performance metrics
- [ ] Review security alerts
- [ ] Verify backups completing
- [ ] Update dependencies (patch versions)
- [ ] Review and rotate logs
- [ ] Check SSL certificate expiry
- [ ] Review on-call incidents

---

## Monthly Maintenance Checklist

- [ ] Rotate secrets/API keys
- [ ] Review and update documentation
- [ ] Security dependency audit
- [ ] Performance baseline review
- [ ] Cost optimization review
- [ ] Disaster recovery drill
- [ ] Update incident response procedures
- [ ] Review access permissions

---

## Quarterly Review

- [ ] Architecture review
- [ ] Security audit
- [ ] Performance optimization
- [ ] Dependency major version updates
- [ ] Infrastructure cost review
- [ ] Capacity planning
- [ ] Documentation comprehensive review
