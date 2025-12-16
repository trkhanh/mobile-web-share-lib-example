# Endpoint Customization Scenarios

This document demonstrates how BFFs can customize downstream service endpoints while using the shared GraphQL library.

## 📦 Files Overview

- **`shared-graphql/EXTENSION_GUIDE.md`** - Comprehensive guide with all patterns
- **`mobile-bff/src/custom-endpoints.ts`** - Mobile-specific endpoint implementations
- **`web-bff/src/custom-endpoints.ts`** - Web-specific endpoint implementations

## 🎯 Available Scenarios

### Mobile BFF Scenarios

#### 1. **Regional Endpoint Override** (`createAPACPayeeDataSource`)
- **Use Case:** Mobile app serves Asia-Pacific users
- **Implementation:** Override payee registry URL to regional endpoint
- **Benefits:** Lower latency, compliance with regional data laws

```typescript
const services = createServices({
  payeeDataSource: createAPACPayeeDataSource()
});
```

#### 2. **Mobile-Optimized Gateway** (`createMobilePaymentGateway`)
- **Use Case:** Handle flaky mobile networks
- **Features:**
  - 5-second timeout (faster than default)
  - Automatic retry (2 attempts)
  - Mobile-specific headers
- **Benefits:** Better UX on mobile networks

```typescript
const services = createServices({
  paymentGateway: createMobilePaymentGateway()
});
```

#### 3. **Version-Based Routing** (`createVersionedMobileGateway`)
- **Use Case:** Different app versions need different API versions
- **Logic:** 
  - App v3.x+ → API v2 (new features)
  - App v1.x-2.x → API v1 (legacy)
- **Benefits:** Gradual API migration, backward compatibility

```typescript
const appVersion = req.headers['x-app-version']; // e.g., "3.2.1"
const services = createServices({
  paymentGateway: createVersionedMobileGateway(appVersion)
});
```

### Web BFF Scenarios

#### 1. **Environment-Based Configuration** (`createEnvAwarePayeeDataSource`)
- **Use Case:** Different URLs for dev/staging/prod
- **Implementation:** Config-driven endpoint selection
- **Environments:**
  - Development: `localhost:8081`
  - Staging: `staging.example.com`
  - Production: `example.com`

```typescript
const services = createServices({
  payeeDataSource: createEnvAwarePayeeDataSource()
});
```

#### 2. **Multi-Region with Fallback** (`createMultiRegionPaymentGateway`)
- **Use Case:** High availability for web application
- **Regions:** US-East → US-West → EU-Central
- **Benefits:** Automatic failover, 99.9%+ uptime

```typescript
const services = createServices({
  paymentGateway: createMultiRegionPaymentGateway()
});
```

#### 3. **Authenticated Gateway** (`createAuthenticatedPaymentGateway`)
- **Use Case:** Add JWT authentication to downstream calls
- **Features:**
  - Bearer token injection
  - Request ID tracking
  - Web-specific headers

```typescript
const getUserToken = async () => {
  // Get token from session/OAuth
  return await getSessionToken();
};

const services = createServices({
  paymentGateway: createAuthenticatedPaymentGateway(getUserToken)
});
```

#### 4. **Fraud Check Integration** (`createFraudProtectedGateway`)
- **Use Case:** Pre-authorize fraud checking
- **Flow:**
  1. Check transaction for fraud
  2. If fraudulent → reject immediately
  3. If clean → proceed with authorization
- **Strategy:** Fail-open (allows transaction if fraud service down)

```typescript
const baseGateway = createHttpPaymentGateway(url);
const services = createServices({
  paymentGateway: createFraudProtectedGateway(baseGateway)
});
```

## 🚀 Quick Start Examples

### Mobile BFF Server Setup

```typescript
// mobile-bff/src/server.ts
import { createServices } from '@company/shared-graphql';
import { 
  createAPACPayeeDataSource, 
  createVersionedMobileGateway 
} from './custom-endpoints';

app.use('/graphql', (req, res, next) => {
  const appVersion = req.headers['x-app-version'] || '1.0.0';
  
  const services = createServices({
    payeeDataSource: createAPACPayeeDataSource(),
    paymentGateway: createVersionedMobileGateway(appVersion)
  });
  
  req.services = services;
  next();
});
```

### Web BFF Server Setup

```typescript
// web-bff/src/server.ts
import { createServices } from '@company/shared-graphql';
import { 
  createWebServicesWithCustomEndpoints 
} from './custom-endpoints';

const services = createWebServicesWithCustomEndpoints({
  useMultiRegion: process.env.ENABLE_MULTI_REGION === 'true',
  enableFraudCheck: process.env.ENABLE_FRAUD_CHECK === 'true',
  getUserToken: async () => {
    // Your auth logic
    return getSessionToken();
  }
});
```

## 🔧 Implementation Pattern

All customizations follow the same pattern:

1. **Implement the port interface** (`IPaymentGateway`, `IPayeeDataSource`)
2. **Add your custom logic** (retry, auth, routing, etc.)
3. **Pass to factory** via `createServices({ ... })`

```typescript
// 1. Implement the interface
const myCustomGateway: IPaymentGateway = {
  authorize: async (amount, currency, from, to) => {
    // Your custom logic
    return { success: true, providerRef: 'abc123' };
  },
  capture: async (providerRef) => { /* ... */ },
  refund: async (providerRef, amount) => { /* ... */ }
};

// 2. Pass to factory
const services = createServices({
  paymentGateway: myCustomGateway
});

// 3. Use shared services as normal
const result = await services.paymentService.createPayment(...);
```

## 📊 Comparison Matrix

| Feature | Mobile BFF | Web BFF | Shared Library Default |
|---------|------------|---------|------------------------|
| **Endpoints** | Regional (APAC) | Environment-based | Mock/Local |
| **Timeout** | 5s (mobile networks) | 3s-10s (by env) | 30s |
| **Retry Logic** | Yes (2 attempts) | Per region | No |
| **Authentication** | App version header | JWT Bearer token | None |
| **Failover** | None (mobile-optimized single region) | Multi-region | None |
| **Fraud Check** | No | Optional | No |

## 🎓 Best Practices

1. **Always implement the full interface** - Don't leave methods unimplemented
2. **Log custom behavior** - Add logging for debugging
3. **Handle errors gracefully** - Return proper error format
4. **Test with real endpoints** - Use environment variables for testing
5. **Document your customizations** - Keep this file updated

## 🔍 Testing Custom Endpoints

```typescript
// Test with overrides
const services = createServices({
  paymentGateway: {
    authorize: async () => ({ success: true, providerRef: 'test-123' }),
    capture: async () => ({ success: true }),
    refund: async () => ({ success: true })
  }
});

const result = await services.paymentService.createPayment({
  amount: 100,
  currency: 'USD',
  fromAccount: '12345678',
  toAccount: '87654321'
});

expect(result.success).toBe(true);
```

## 📚 Additional Resources

- [EXTENSION_GUIDE.md](../shared-graphql/EXTENSION_GUIDE.md) - Full extension patterns
- [FUNCTIONAL_ARCHITECTURE.md](../shared-graphql/FUNCTIONAL_ARCHITECTURE.md) - Architecture overview
- [Architecture.md](../Architecture.md) - System design diagram

## 🤝 Contributing

When adding new endpoint customization scenarios:
1. Add implementation to appropriate BFF's `custom-endpoints.ts`
2. Update this README with use case and example
3. Add tests demonstrating the customization
4. Document any new environment variables needed
