# Development Rules & Guidelines

## 1. Code Organization Principles

### 1.1 Monorepo Structure
- Use **Turborepo** for monorepo management
- Use **PNPM** as package manager for efficient dependency management
- All shared code goes in `packages/shared`
- Each app is independent but shares common packages

### 1.2 Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files (components) | PascalCase | `OrderCard.tsx` |
| Files (utilities) | camelCase | `formatDate.ts` |
| Files (constants) | SCREAMING_SNAKE | `API_ENDPOINTS.ts` |
| Folders | kebab-case | `order-tracking/` |
| React Components | PascalCase | `OrderTracker` |
| Functions | camelCase | `calculateDeliveryFee` |
| Constants | SCREAMING_SNAKE | `MAX_DELIVERY_RADIUS` |
| Database Tables | snake_case | `delivery_orders` |
| API Endpoints | kebab-case | `/api/v1/delivery-orders` |

### 1.3 File Structure within Components
```
ComponentName/
├── index.ts              # Export barrel
├── ComponentName.tsx     # Main component
├── ComponentName.test.tsx # Tests
├── ComponentName.styles.ts # Styles (if needed)
└── hooks/                # Component-specific hooks
    └── useComponentLogic.ts
```

## 2. Technology Standards

### 2.1 Frontend (Web) - Next.js
- Use **App Router** (not Pages Router)
- Server Components by default, Client Components only when needed
- Use `'use client'` directive sparingly
- Implement proper loading and error states
- Use **Tailwind CSS** for styling
- Use **shadcn/ui** for component library

### 2.2 Frontend (Mobile) - React Native
- Use **Expo** for easier development and deployment
- Use **Expo Router** for navigation
- Follow React Native best practices for performance
- Use **NativeWind** (Tailwind for RN) for consistent styling

### 2.3 Backend - Express.js
- RESTful API design
- Versioned endpoints (`/api/v1/...`)
- Controller-Service-Repository pattern
- Input validation with **Zod**
- Error handling middleware
- Request logging with **Morgan**
- Rate limiting on all endpoints

### 2.4 Database - Supabase
- Use Supabase client for real-time features
- Row Level Security (RLS) for all tables
- Database functions for complex operations
- Proper indexing strategy
- Use transactions for multi-table operations

## 3. API Design Standards

### 3.1 REST Conventions
```
GET    /api/v1/orders          # List orders
GET    /api/v1/orders/:id      # Get single order
POST   /api/v1/orders          # Create order
PATCH  /api/v1/orders/:id      # Update order
DELETE /api/v1/orders/:id      # Delete order
```

### 3.2 Response Format
```json
{
  "success": true,
  "data": { },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

### 3.3 Error Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": []
  }
}
```

### 3.4 HTTP Status Codes
| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (successful delete) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Unprocessable Entity |
| 429 | Rate Limited |
| 500 | Internal Server Error |

## 4. Authentication & Authorization

### 4.1 Authentication Flow
1. User signs up/logs in via Supabase Auth
2. Supabase returns JWT token
3. Token stored securely (httpOnly cookie for web, SecureStore for mobile)
4. Token sent with each API request
5. Backend validates token with Supabase

### 4.2 User Roles
- `customer` - End users placing orders
- `driver` - Delivery personnel
- `merchant` - Restaurant/store owners
- `admin` - Platform administrators
- `super_admin` - Full system access

### 4.3 Authorization
- Role-based access control (RBAC)
- Row Level Security in Supabase
- API middleware for route protection

## 5. Real-time Features

### 5.1 Supabase Realtime Usage
- Order status updates
- Driver location tracking
- Chat between customer and driver
- Merchant order notifications

### 5.2 Implementation Pattern
```typescript
// Subscribe to order updates
const channel = supabase
  .channel('order-updates')
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
    (payload) => handleOrderUpdate(payload)
  )
  .subscribe()
```

## 6. Environment Management

### 6.1 Environment Files
```
.env.local          # Local development (not committed)
.env.development    # Development defaults
.env.staging        # Staging environment
.env.production     # Production environment
```

### 6.2 Required Environment Variables
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# API
API_URL=
API_SECRET=

# Stripe
STRIPE_PUBLIC_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Maps
MAPBOX_ACCESS_TOKEN=
GOOGLE_MAPS_API_KEY=

# Firebase (for push notifications)
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
```

## 7. Git Workflow

### 7.1 Branch Naming
```
main                    # Production-ready code
develop                 # Integration branch
feature/LMA-123-desc    # Feature branches
bugfix/LMA-456-desc     # Bug fixes
hotfix/LMA-789-desc     # Production hotfixes
release/v1.0.0          # Release branches
```

### 7.2 Commit Messages
Follow Conventional Commits:
```
feat: add order tracking page
fix: resolve payment processing error
docs: update API documentation
style: format code with prettier
refactor: restructure order service
test: add unit tests for cart
chore: update dependencies
```

### 7.3 Pull Request Process
1. Create feature branch from `develop`
2. Make changes with proper commits
3. Push and create PR to `develop`
4. Require at least 1 review
5. Pass all CI checks
6. Squash and merge

## 8. Testing Strategy

### 8.1 Testing Pyramid
- **Unit Tests**: 70% - Individual functions and components
- **Integration Tests**: 20% - API endpoints, database operations
- **E2E Tests**: 10% - Critical user flows

### 8.2 Testing Tools
| Type | Tool |
|------|------|
| Unit (JS) | Vitest |
| React Components | React Testing Library |
| E2E | Playwright |
| API | Supertest |
| Mobile | Detox |

### 8.3 Test File Location
- Co-located with source files
- `ComponentName.test.tsx`
- `service.test.ts`

## 9. Performance Standards

### 9.1 Web Vitals Targets
| Metric | Target |
|--------|--------|
| LCP | < 2.5s |
| FID | < 100ms |
| CLS | < 0.1 |
| TTFB | < 600ms |

### 9.2 API Performance
- Response time < 200ms for simple queries
- Response time < 500ms for complex queries
- Implement caching where appropriate
- Use database connection pooling

### 9.3 Mobile Performance
- App launch < 2s
- Screen transitions < 300ms
- Smooth 60fps animations

## 10. Security Standards

### 10.1 Must Implement
- Input validation on all endpoints
- SQL injection prevention (parameterized queries)
- XSS prevention (sanitize outputs)
- CSRF protection
- Rate limiting
- HTTPS everywhere
- Secure headers (HSTS, CSP, etc.)

### 10.2 Data Protection
- Encrypt sensitive data at rest
- Never log sensitive information
- PCI compliance for payments
- GDPR compliance for EU users

## 11. Deployment Pipeline

### 11.1 Environments
| Environment | Purpose | URL Pattern |
|-------------|---------|-------------|
| Local | Development | localhost:3000 |
| Preview | PR previews | pr-123.lma.vercel.app |
| Staging | Pre-production | staging.lma.app |
| Production | Live | lma.app |

### 11.2 CI/CD Flow
```
Push to branch → Run Tests → Build → Deploy to Preview
Merge to develop → Run Tests → Build → Deploy to Staging
Merge to main → Run Tests → Build → Deploy to Production
```

### 11.3 Deployment Targets
| App | Platform | Trigger |
|-----|----------|---------|
| Web App | Vercel | Git push |
| Admin Dashboard | Vercel | Git push |
| API Server | Render | Git push |
| Mobile App | EAS Build | Manual/CI |

## 12. Monitoring & Logging

### 12.1 Tools
- **Error Tracking**: Sentry
- **Analytics**: Mixpanel / Amplitude
- **Logs**: Render logs + Supabase logs
- **Uptime**: Better Uptime

### 12.2 Log Levels
- `error` - Errors requiring immediate attention
- `warn` - Potential issues
- `info` - General operational info
- `debug` - Detailed debugging (dev only)

## 13. Documentation Requirements

### 13.1 Code Documentation
- JSDoc for public functions
- README in each package
- Inline comments for complex logic only

### 13.2 API Documentation
- OpenAPI/Swagger specification
- Postman collection
- Example requests and responses

### 13.3 Architecture Documentation
- System architecture diagrams
- Database ERD
- Sequence diagrams for complex flows
