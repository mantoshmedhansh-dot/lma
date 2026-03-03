# LMA Gap Analysis Report

## Comparison with Shipsy, FarEye, Locus.sh, Onfleet, Track-POD & LogiNext

**Report Date:** February 25, 2026
**Prepared for:** LMA Platform
**Repository:** https://github.com/mantoshmedhansh-dot/lma

---

## Executive Summary

LMA is an early-stage last-mile delivery platform with a solid database foundation (58 tables, PostGIS, RLS) and a broad feature surface area. However, there is a **significant gap between the database schema sophistication and actual application implementation**. Many features exist only as DB tables or stub API code with no working frontend or live integration.

When compared against industry leaders (Shipsy, FarEye, Locus.sh, Onfleet, Track-POD, LogiNext), LMA covers approximately **25-30%** of the feature set expected in a production-grade last-mile platform.

---

## 1. Feature Comparison Matrix

| Feature Category                 | Shipsy  | FarEye  | Locus.sh | Onfleet | Track-POD | LogiNext |     **LMA**     | **LMA Status**                                                      |
| -------------------------------- | :-----: | :-----: | :------: | :-----: | :-------: | :------: | :-------------: | ------------------------------------------------------------------- |
| **Order Management**             |   Yes   |   Yes   |   Yes    |   Yes   |    Yes    |   Yes    |   **Partial**   | Core CRUD works; no bulk ops, no SLA management                     |
| **Route Optimization (AI)**      |   Yes   |   Yes   |   Yes    |   Yes   |    Yes    |   Yes    |    **Basic**    | Nearest-neighbor TSP only; no ML, no traffic API                    |
| **Real-time GPS Tracking**       |   Yes   |   Yes   |   Yes    |   Yes   |    Yes    |   Yes    |     **No**      | DB columns exist; no live map, no WebSocket stream                  |
| **Live Map View**                |   Yes   |   Yes   |   Yes    |   Yes   |    Yes    |   Yes    |     **No**      | react-native-maps installed but unused; no Mapbox/Google Maps SDK   |
| **Proof of Delivery**            |   Yes   |   Yes   |   Yes    |   Yes   |    Yes    |   Yes    |     **Yes**     | Photo + signature capture in driver app                             |
| **COD Management**               | Partial |   Yes   | Partial  |   No    |    Yes    |   Yes    |     **Yes**     | Full flow: collection, balance, deposit                             |
| **Payment Gateway**              |   Yes   |   Yes   |   Yes    |   Yes   |  Partial  |   Yes    |     **No**      | Stripe configured but zero payment flows implemented                |
| **Push Notifications**           |   Yes   |   Yes   |   Yes    |   Yes   |    Yes    |   Yes    |     **No**      | FCM service class exists but SDK not installed; mocked              |
| **SMS/WhatsApp Alerts**          |   Yes   |   Yes   |   Yes    |   Yes   |    Yes    |   Yes    |     **No**      | Twilio/MSG91 classes exist but mocked; packages not installed       |
| **Email Notifications**          |   Yes   |   Yes   |   Yes    |   Yes   |    Yes    |   Yes    |     **No**      | Service file exists, not functional                                 |
| **Customer ETA Tracking**        |   Yes   |   Yes   |   Yes    |   Yes   |    Yes    |   Yes    |   **Partial**   | Tracking token system built; no live map/WebSocket                  |
| **Demand Forecasting**           |   Yes   |   Yes   |   Yes    |   No    |    No     |   Yes    |    **Stub**     | Rule-based hourly lookup; no real ML training                       |
| **Auto-assign / Smart Dispatch** |   Yes   |   Yes   |   Yes    |   Yes   |    No     |   Yes    |    **Stub**     | Scoring algorithm exists; not connected to live workflow            |
| **Geofencing**                   |   Yes   |   Yes   |   Yes    |   Yes   |    No     |   Yes    |    **Stub**     | Ray-casting algo + zones table; no live triggers                    |
| **Surge Pricing**                |   Yes   | Partial |   Yes    |   No    |    No     |   Yes    |    **Stub**     | Rules table + calculator; not wired to checkout                     |
| **3PL Integration**              |   Yes   |   Yes   |   Yes    |   No    |  Partial  |   Yes    | **Schema Only** | DB tables for Delhivery/BlueDart/Shiprocket; no partner API clients |
| **Shopify Integration**          | Partial |   Yes   |    No    | Partial |    No     | Partial  |     **Yes**     | OAuth, webhooks, order sync implemented                             |
| **ONDC Compliance**              |   No    |   No    |    No    |   No    |    No     |    No    | **Scaffolded**  | Protocol handlers built; not live on network                        |
| **Analytics Dashboard**          |   Yes   |   Yes   |   Yes    |   Yes   |    Yes    |   Yes    |    **Basic**    | Recharts in superadmin; 5 KPI categories in API                     |
| **Scheduled Reports**            |   Yes   |   Yes   |   Yes    | Partial |    Yes    |   Yes    | **Schema Only** | DB tables exist; no report generation running                       |
| **Multi-tenant**                 |   Yes   |   Yes   |   Yes    |   Yes   |  Partial  |   Yes    |     **Yes**     | Merchant isolation via RLS                                          |
| **Driver Earnings**              |   Yes   |   Yes   | Partial  |   Yes   |  Partial  |   Yes    |   **Partial**   | DB tables + driver app earnings tab; no payout integration          |
| **Customer Ratings**             |   Yes   |   Yes   |   Yes    |   Yes   |    Yes    |   Yes    | **Schema Only** | Tables exist; no rating UI in customer apps                         |
| **Fleet Management**             |   Yes   |   Yes   |   Yes    |   Yes   |  Partial  |   Yes    |     **No**      | No vehicle management, maintenance tracking, or fleet dashboard     |
| **Returns/Reverse Logistics**    |   Yes   |   Yes   |   Yes    |   No    |    Yes    |   Yes    |     **No**      | Not addressed anywhere in codebase                                  |
| **Multi-language (i18n)**        |   Yes   |   Yes   |   Yes    |   Yes   |    Yes    |   Yes    |     **No**      | No i18n setup in any app                                            |
| **GDPR / Compliance**            |   Yes   |   Yes   |   Yes    |   Yes   |    Yes    |   Yes    |   **Partial**   | Audit logs with hash chain, consent tables, data export API         |
| **Webhook System**               |   Yes   |   Yes   |   Yes    |   Yes   |    Yes    |   Yes    |     **Yes**     | Full CRUD + delivery logging                                        |
| **API Documentation**            |   Yes   |   Yes   |   Yes    |   Yes   |    Yes    |   Yes    |   **Partial**   | FastAPI auto-docs; Node API undocumented                            |
| **Test Coverage**                |  High   |  High   |   High   |  High   |  Medium   |   High   |    **<10%**     | 6 API tests, 3 UI tests, 5 E2E specs                                |
| **CI/CD Pipeline**               |   Yes   |   Yes   |   Yes    |   Yes   |    Yes    |   Yes    |   **Partial**   | GitHub Actions configured; deploy pipeline has issues               |

---

## 2. Critical Gaps (Must Fix for Production)

### 2.1 No Payment Processing

**Gap:** Stripe is listed as the payment provider but zero payment flows are implemented. No payment intent creation, no webhook handling for payment events, no refund flow.

**Industry Standard:** All competitors support multiple payment gateways with PCI-compliant tokenization, auto-retry, and refund management.

**Recommendation:**

- Implement Stripe Payment Intents in the Python API
- Add Razorpay as an alternative for Indian market
- Build payment webhook handlers for async confirmation
- Implement refund flow tied to order cancellation
- **Priority: P0 (Blocker)**

### 2.2 No Real-time GPS Tracking or Map View

**Gap:** No live map rendering anywhere in the platform. `react-native-maps` is installed in the driver app but never used. No Mapbox or Google Maps SDK.

**Industry Standard:** All 6 competitors provide real-time map views for customers, merchants, and dispatchers. This is table-stakes functionality for any delivery platform.

**Recommendation:**

- Integrate Google Maps SDK (or Mapbox) in driver app with live location streaming
- Add map view to customer order tracking page
- Add fleet map to superadmin dashboard
- Use Supabase Realtime or WebSockets for location streaming (currently REST polling only)
- **Priority: P0 (Blocker)**

### 2.3 No Push Notifications

**Gap:** FCM service class is fully designed but Firebase Admin SDK is not installed. All `send()` calls are mocked/commented out. Same for SMS (Twilio/MSG91).

**Industry Standard:** Every competitor sends real-time push + SMS for order status changes, driver arrival, delivery completion.

**Recommendation:**

- Install `firebase-admin` and activate FCM push in Node API
- Install `twilio` or `msg91` package for SMS
- Wire notification triggers to order status change events
- **Priority: P0 (Blocker)**

### 2.4 No Live Route Optimization

**Gap:** Current route optimization uses a basic nearest-neighbor greedy algorithm with hardcoded speed profiles. No integration with Google Maps Directions API or OSRM for actual road-network routing.

**Industry Standard:**

- **Shipsy:** ML-powered with real-time traffic, vehicle capacity constraints, time windows
- **Locus.sh:** Proprietary geocoding + routing engine
- **FarEye:** Predictive routing with dynamic re-routing

**Recommendation:**

- Integrate Google Maps Directions API or OSRM for real road-distance routing
- Add time-window constraints and vehicle capacity
- Replace greedy TSP with OR-Tools (Google's optimization library) or similar
- **Priority: P1 (High)**

---

## 3. Major Gaps (Required for Market Competitiveness)

### 3.1 Python API Migration Incomplete

**Gap:** The Python FastAPI (designated as "primary") only has 5 route groups (auth, merchants, orders, deliveries, health). The Node.js API has 10 route groups with ~70+ endpoints including intelligence, analytics, integrations, notifications, and security. The Python API is missing 50+ endpoints.

**Recommendation:** Either:

- (A) Complete the Python migration (recommended for long-term)
- (B) Deploy the Node.js API on Render instead and continue development there
- **Priority: P1 (High)**

### 3.2 No Returns / Reverse Logistics

**Gap:** No return order flow, no reverse pickup scheduling, no refund-on-return.

**Industry Standard:**

- **Shipsy/FarEye:** Full reverse logistics with pickup scheduling, quality check workflows
- **Track-POD:** Return receipt and damage documentation

**Recommendation:** Add return order type, reverse pickup assignment, and return-triggered refund flow.

- **Priority: P1 (High)**

### 3.3 No Fleet Management

**Gap:** No vehicle registration, maintenance scheduling, document tracking (insurance, license), or fuel management.

**Industry Standard:** All enterprise competitors (Shipsy, FarEye, LogiNext) include comprehensive fleet management modules.

**Recommendation:** Add vehicles table, link to drivers, build fleet dashboard in superadmin.

- **Priority: P2 (Medium)**

### 3.4 No Multi-language Support (i18n)

**Gap:** All UI strings are hardcoded in English. No i18n framework configured.

**Industry Standard:** All competitors support 10+ languages. Critical for Indian market (Hindi, Tamil, etc.).

**Recommendation:** Add `next-intl` or `react-i18next` to web apps, `expo-localization` + `i18next` to mobile.

- **Priority: P2 (Medium)**

### 3.5 Test Coverage Under 10%

**Gap:** 6 API route tests, 3 component tests, 5 E2E specs. No service-layer tests, no Python API tests, no mobile tests.

**Industry Standard:** Enterprise platforms maintain 70-80%+ test coverage.

**Recommendation:** Prioritize testing for payment, order, and delivery flows. Add Python API tests with pytest.

- **Priority: P2 (Medium)**

---

## 4. Tech Stack Comparison

| Component         | LMA Current              | Shipsy              | FarEye           | Locus.sh      | Onfleet      | **Best Practice**                   |
| ----------------- | ------------------------ | ------------------- | ---------------- | ------------- | ------------ | ----------------------------------- |
| **Frontend Web**  | Next.js 14               | React               | React            | React         | React        | Next.js 14 (LMA is current)         |
| **Mobile**        | React Native + Expo 50   | React Native        | Flutter          | React Native  | React Native | React Native or Flutter             |
| **Backend**       | FastAPI + Express (dual) | Java/Spring         | Java/Spring      | Go + Python   | Node.js      | Single stack (FastAPI or Go)        |
| **Database**      | PostgreSQL (Supabase)    | PostgreSQL          | PostgreSQL       | PostgreSQL    | PostgreSQL   | PostgreSQL (LMA is aligned)         |
| **Geospatial**    | PostGIS                  | PostGIS + Redis Geo | PostGIS          | Custom engine | PostGIS      | PostGIS + Redis Geo cache           |
| **Search**        | pg_trgm                  | Elasticsearch       | Elasticsearch    | Elasticsearch | Algolia      | Elasticsearch or Meilisearch        |
| **Cache**         | Supabase table-based     | Redis               | Redis            | Redis         | Redis        | **Redis** (LMA gap)                 |
| **Message Queue** | None                     | RabbitMQ/Kafka      | Kafka            | Kafka         | -            | **Redis/BullMQ or Kafka** (LMA gap) |
| **Real-time**     | Supabase Realtime        | WebSocket + Kafka   | WebSocket + MQTT | Custom WS     | Firebase     | WebSocket + Message broker          |
| **Maps**          | None implemented         | Google Maps         | HERE Maps        | Proprietary   | Mapbox       | Google Maps or Mapbox               |
| **Route Engine**  | Haversine + greedy TSP   | Proprietary ML      | Proprietary ML   | Proprietary   | OSRM         | Google OR-Tools / OSRM              |
| **ML/AI**         | Rule-based heuristics    | TensorFlow/PyTorch  | ML pipelines     | Custom ML     | None         | scikit-learn minimum                |
| **Payments**      | Stripe (not implemented) | Multiple gateways   | Multiple         | Stripe        | Stripe       | Stripe + local gateways             |
| **Auth**          | Supabase Auth            | Custom JWT          | Okta/Auth0       | Custom        | Custom       | Supabase Auth is solid              |
| **Monitoring**    | Sentry (web only)        | Datadog             | New Relic        | Prometheus    | -            | Sentry + Prometheus + Grafana       |
| **CI/CD**         | GitHub Actions           | Jenkins/GitLab CI   | Jenkins          | GitLab CI     | CircleCI     | GitHub Actions (LMA is fine)        |

### Tech Stack Gaps:

1. **No Redis** - Using Supabase table as cache is 100x slower than Redis for hot data (driver locations, session data)
2. **No Message Queue** - Order events, notification dispatching, webhook delivery all need async processing (BullMQ or Kafka)
3. **No Elasticsearch** - Product/merchant search uses basic pg_trgm; won't scale for autocomplete, fuzzy matching, faceted search
4. **Dual backend problem** - Running both Express.js and FastAPI creates maintenance burden; consolidate to one

---

## 5. ONDC Compliance Assessment

| ONDC Requirement                                   | LMA Status  | Gap                                       |
| -------------------------------------------------- | ----------- | ----------------------------------------- |
| Beckn Protocol (search/select/init/confirm/status) | Implemented | Needs testing against ONDC sandbox        |
| Digital Signing (Ed25519)                          | Implemented | Key generation works                      |
| Encryption (X25519)                                | Implemented | Needs verification                        |
| Registry Subscription                              | Not done    | Must register on ONDC registry            |
| Catalog Format (ONDC spec)                         | Not done    | Product catalog needs ONDC schema mapping |
| Settlement Protocol                                | Not done    | Payment settlement per ONDC specs         |
| Grievance Redressal                                | Not done    | Required by ONDC policy                   |
| IGM (Issue & Grievance Mgmt)                       | Not done    | Mandatory for network participation       |
| LSP (Logistics Service Provider) role              | Scaffolded  | Needs full compliance testing             |

**Verdict:** LMA has a good head start on ONDC but is **not production-ready**. Estimate 4-6 weeks of focused work to achieve ONDC sandbox certification.

---

## 6. Scalability Assessment

| Dimension                   | LMA Current              | Industry Standard                  | Gap                                                              |
| --------------------------- | ------------------------ | ---------------------------------- | ---------------------------------------------------------------- |
| **Concurrent Orders**       | ~100 (DB query limit)    | 100K+                              | No pagination cursor, no caching layer                           |
| **Driver Location Updates** | REST polling             | WebSocket at 5-15s intervals       | No streaming; REST is 10x more expensive                         |
| **Database**                | Single Supabase instance | Read replicas + connection pooling | Supabase handles pooling; no read replicas                       |
| **API**                     | Single Render instance   | Auto-scaling containers (K8s)      | Render supports auto-scaling                                     |
| **CDN**                     | Vercel Edge (built-in)   | Cloudflare/Fastly                  | Vercel is adequate                                               |
| **Background Jobs**         | None                     | Redis + BullMQ workers             | No async job processing at all                                   |
| **Rate Limiting**           | DB-based log table       | Redis-based (slowapi for FastAPI)  | slowapi is in Python requirements; Node API has no rate limiting |
| **File Storage**            | Supabase Storage         | S3 + CDN                           | Supabase Storage is adequate for current scale                   |

---

## 7. Security Assessment

| Security Feature   | LMA Status | Notes                                                                        |
| ------------------ | ---------- | ---------------------------------------------------------------------------- |
| Authentication     | Good       | Supabase Auth with JWT, Google OAuth                                         |
| Row Level Security | Good       | RLS on 18+ tables                                                            |
| API Authentication | Present    | JWT middleware in both APIs                                                  |
| CORS               | Configured | vercel.json headers (but `Access-Control-Allow-Origin: *` is too permissive) |
| Rate Limiting      | Partial    | Python API has slowapi; Node API has none                                    |
| Audit Logging      | Good       | Hash-chain audit logs with integrity verification                            |
| GDPR Compliance    | Partial    | Data export/deletion APIs exist; consent management scaffolded               |
| Input Validation   | Partial    | Pydantic in Python; Zod schemas in some Node routes                          |
| SQL Injection      | Protected  | Supabase client handles parameterization                                     |
| XSS                | Protected  | React's built-in escaping + security headers                                 |
| Secrets Management | Needs Work | Environment variables; no vault integration                                  |

**Critical Security Issue:** `Access-Control-Allow-Origin: *` in vercel.json allows any domain to make credentialed API requests. Should be restricted to known domains.

---

## 8. Prioritized Roadmap Recommendation

### Phase 1: Production Readiness (Weeks 1-4)

| Task                                                | Priority | Effort |
| --------------------------------------------------- | -------- | ------ |
| Implement Stripe payment flow (intents + webhooks)  | P0       | 1 week |
| Integrate Google Maps SDK in driver + customer apps | P0       | 1 week |
| Activate FCM push notifications                     | P0       | 3 days |
| Activate SMS (Twilio/MSG91)                         | P0       | 2 days |
| Run database migrations on Supabase                 | P0       | 1 day  |
| Fix CORS to restrict origins                        | P0       | 1 hour |
| Decide Node.js vs Python API and deploy one         | P0       | 2 days |
| Add Redis for caching + driver locations            | P1       | 3 days |

### Phase 2: Feature Parity (Weeks 5-10)

| Task                                         | Priority | Effort  |
| -------------------------------------------- | -------- | ------- |
| Live GPS tracking with WebSocket streaming   | P1       | 1 week  |
| Google OR-Tools / OSRM route optimization    | P1       | 1 week  |
| Customer rating/review UI                    | P1       | 3 days  |
| Returns/reverse logistics flow               | P1       | 1 week  |
| Complete Python API migration (or remove it) | P1       | 2 weeks |
| Add BullMQ for background job processing     | P1       | 3 days  |
| Increase test coverage to 50%+               | P2       | 2 weeks |

### Phase 3: Competitive Advantage (Weeks 11-16)

| Task                                         | Priority | Effort  |
| -------------------------------------------- | -------- | ------- |
| ONDC sandbox certification                   | P1       | 4 weeks |
| ML-powered demand forecasting (scikit-learn) | P2       | 2 weeks |
| Multi-language support (i18n)                | P2       | 1 week  |
| Fleet management module                      | P2       | 2 weeks |
| Elasticsearch for search                     | P2       | 1 week  |
| 3PL partner API integrations                 | P2       | 2 weeks |
| Advanced analytics with Grafana/Metabase     | P2       | 1 week  |

---

## 9. What LMA Does Well

1. **Database Architecture** - 58 tables with PostGIS, RLS, triggers, and 7 well-structured migrations. This is enterprise-grade schema design.
2. **Monorepo Structure** - Clean turborepo setup with shared packages, consistent tooling.
3. **POD + COD Flow** - Proof of Delivery (photo + signature) and Cash on Delivery management is fully end-to-end. This is ahead of some competitors (Onfleet lacks COD).
4. **Shopify Integration** - Full OAuth + webhook sync is production-ready.
5. **ONDC Head Start** - No competitor in this comparison has ONDC support. LMA's scaffolding gives it a first-mover advantage in the Indian market.
6. **GDPR/Audit Infrastructure** - Hash-chain audit logs and consent management is more sophisticated than most startups.
7. **Webhook System** - Full webhook delivery infrastructure with retry logging.
8. **Modern Tech Stack** - Next.js 14, FastAPI, Expo 50, Supabase - all current-generation choices.

---

## 10. Conclusion

LMA has built a **strong architectural foundation** with an impressive database schema and broad feature scaffolding. The key challenge is converting this foundation into **working, production-ready features**.

The three most critical gaps blocking production launch are:

1. **Payment processing** (no revenue without it)
2. **Real-time tracking with maps** (table-stakes for delivery)
3. **Push/SMS notifications** (core user experience)

With focused execution on the Phase 1 roadmap (4 weeks), LMA can reach a minimum viable production state. The ONDC scaffolding and Shopify integration provide genuine competitive differentiation that none of the major competitors currently offer.

---

_Report generated by automated codebase audit + competitor research analysis._
