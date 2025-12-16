# Design Flexibility Summary

This document summarizes ALL the ways BFFs can customize the shared library to meet different demands.

## 🎯 Three-Layer Customization Architecture

```
┌─────────────────────────────────────────────────┐
│         GraphQL Layer (Flexible)                │
│  ✅ Use shared schemas                          │
│  ✅ Extend shared schemas                       │
│  ✅ Create completely custom schemas            │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│      Service Layer (Can Override)               │
│  ✅ Use shared services                         │
│  ✅ Wrap shared services with custom logic      │
│  ✅ Create custom services                      │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│    Infrastructure Layer (Fully Pluggable)       │
│  ✅ Custom loggers                              │
│  ✅ Custom storage backends                     │
│  ✅ Custom HTTP gateways & endpoints            │
│  ✅ Environment-specific configs                │
└─────────────────────────────────────────────────┘
```

---

## 📋 Customization Checklist

### ✅ GraphQL Customization (NEW!)

**Question: "Our mobile app needs a simpler GraphQL API than web"**

| Approach | Documentation | Example Code |
|----------|---------------|--------------|
| Extend shared types | [GRAPHQL_CUSTOMIZATION.md](./GRAPHQL_CUSTOMIZATION.md#scenario-a-add-new-fields-to-existing-types) | [mobile-bff/src/custom-schema.ts](./mobile-bff/src/custom-schema.ts) |
| Add new queries | [GRAPHQL_CUSTOMIZATION.md](./GRAPHQL_CUSTOMIZATION.md#scenario-b-add-new-queriesmutations) | [web-bff/src/custom-schema.ts](./web-bff/src/custom-schema.ts) |
| Custom schema | [GRAPHQL_CUSTOMIZATION.md](./GRAPHQL_CUSTOMIZATION.md#level-3-completely-custom-graphql) | [mobile-bff/src/custom-schema.ts](./mobile-bff/src/custom-schema.ts) |

**Supported:**
- ✅ Add mobile-specific fields (deviceId, platform, biometricRequired)
- ✅ Add web admin features (analytics, audit logs, system health)
- ✅ Create simplified mobile schema (less fields, simpler names)
- ✅ Add pagination for web tables
- ✅ Override resolver behavior per BFF
- ✅ Mix shared and custom resolvers freely

---

### ✅ Service Customization

**Question: "We need different business logic for mobile vs web"**

| Approach | Documentation | Example Code |
|----------|---------------|--------------|
| Wrap services | [BFF_EXTENSION_GUIDE.md](./BFF_EXTENSION_GUIDE.md#pattern-3-wrap-service-with-custom-logic) | [mobile-bff/src/server.ts](./mobile-bff/src/server.ts) |
| Create custom | [BFF_EXTENSION_GUIDE.md](./BFF_EXTENSION_GUIDE.md) | Both BFFs |

**Supported:**
- ✅ Add pre-validation (biometric checks, fraud detection)
- ✅ Add post-processing (notifications, logging, caching)
- ✅ Custom validation rules per BFF
- ✅ Still reuse core business logic

---

### ✅ Infrastructure Customization

**Question: "Production uses Redis, but dev uses in-memory"**

| Approach | Documentation | Example Code |
|----------|---------------|--------------|
| Custom logger | [BFF_EXTENSION_GUIDE.md](./BFF_EXTENSION_GUIDE.md#pattern-1-custom-logger) | mobile-bff, web-bff |
| Custom storage | [BFF_EXTENSION_GUIDE.md](./BFF_EXTENSION_GUIDE.md#pattern-2-custom-storage-backend) | [web-bff examples](./web-bff/src/server.ts) |
| Custom gateway | [ENDPOINT_CUSTOMIZATION.md](./ENDPOINT_CUSTOMIZATION.md) | [custom-endpoints.ts](./mobile-bff/src/custom-endpoints.ts) |

**Supported:**
- ✅ Environment-based configuration
- ✅ Cloud-specific implementations (AWS, Azure, GCP)
- ✅ Custom authentication/authorization
- ✅ Regional endpoints
- ✅ Multi-region failover
- ✅ Protocol translation (REST → gRPC)

---

### ✅ Endpoint Customization

**Question: "Mobile calls different APIs than web"**

| Approach | Documentation | Example Code |
|----------|---------------|--------------|
| Regional endpoints | [ENDPOINT_CUSTOMIZATION.md](./ENDPOINT_CUSTOMIZATION.md#mobile-bff-scenarios) | [mobile-bff/src/custom-endpoints.ts](./mobile-bff/src/custom-endpoints.ts) |
| Environment config | [ENDPOINT_CUSTOMIZATION.md](./ENDPOINT_CUSTOMIZATION.md#web-bff-scenarios) | [web-bff/src/custom-endpoints.ts](./web-bff/src/custom-endpoints.ts) |
| Version routing | [EXTENSION_GUIDE.md](./shared-graphql/EXTENSION_GUIDE.md#5-api-version-routing) | [mobile-bff examples](./mobile-bff/src/custom-endpoints.ts) |

**Supported:**
- ✅ Region-specific URLs (APAC, EMEA, Americas)
- ✅ Environment URLs (dev/staging/prod)
- ✅ API version routing (v1/v2)
- ✅ Mobile-optimized timeouts
- ✅ Retry strategies per BFF
- ✅ Custom headers (auth, tracking)

---

## 🎨 Real-World Examples

### Example 1: Mobile App

**Requirements:**
- Simplified GraphQL schema (less fields)
- Biometric authentication
- Regional endpoints (APAC)
- Offline capability flags
- Device tracking

**Implementation:**
```typescript
// Custom simplified schema
const mobileSchema = `
  type MobilePayee {
    account: String!
    valid: Boolean!
  }
`;

// Custom resolver with mobile logic
const resolver = {
  checkPayee: async (_, { account }, ctx) => {
    if (!ctx.biometricVerified) {
      throw new Error('BIOMETRIC_REQUIRED');
    }
    
    // Still use shared service!
    const result = await services.payeeService.validatePayee({
      accountNumber: account,
      accountName: '',
      bankCode: '001'
    });
    
    return { account, valid: result.isValid };
  }
};
```

**Files:** [mobile-bff/src/custom-schema.ts](./mobile-bff/src/custom-schema.ts)

---

### Example 2: Web Admin Dashboard

**Requirements:**
- Rich GraphQL with analytics
- Audit logging
- Paginated queries
- Batch operations
- Admin-only features

**Implementation:**
```typescript
// Extended schema with admin features
const webExtensions = `
  type PaymentStats {
    totalAmount: Float!
    successRate: Float!
  }

  extend type Query {
    getPaymentStats(fromDate: String!, toDate: String!): PaymentStats!
    getAuditLogs(limit: Int): [AuditLog!]!
  }
`;

// Custom resolvers for admin features
const adminResolvers = {
  Query: {
    // Include shared queries
    ...sharedResolvers.Query,
    
    // Add admin queries
    getPaymentStats: async (_, { fromDate, toDate }) => {
      // Custom admin logic
      return await calculateStats(fromDate, toDate);
    }
  }
};
```

**Files:** [web-bff/src/custom-schema.ts](./web-bff/src/custom-schema.ts)

---

### Example 3: Multi-Region Web

**Requirements:**
- Environment-specific endpoints
- Multi-region failover
- JWT authentication
- Fraud checking

**Implementation:**
```typescript
// Environment-aware gateway
const gateway = createEnvAwareGateway({
  dev: 'https://dev.api.example.com',
  staging: 'https://staging.api.example.com',
  prod: 'https://api.example.com'
});

// Multi-region with failover
const multiRegionGateway = createMultiRegionGateway({
  regions: [
    { name: 'us-east', url: 'https://us-east.api.example.com' },
    { name: 'us-west', url: 'https://us-west.api.example.com' },
    { name: 'eu', url: 'https://eu.api.example.com' }
  ]
});

// Wrap with authentication
const authGateway = createAuthenticatedGateway(
  multiRegionGateway,
  getUserJwtToken
);

// Wrap with fraud checking
const secureGateway = createFraudProtectedGateway(authGateway);
```

**Files:** [web-bff/src/custom-endpoints.ts](./web-bff/src/custom-endpoints.ts)

---

## 🔑 Key Design Principles

1. **Functional Core, Imperative Shell**
   - Pure business logic in `core/` (zero dependencies)
   - Side effects in infrastructure layer (pluggable)
   - Services compose pure functions with infrastructure

2. **Port-Based Architecture**
   - All infrastructure behind interfaces (ILogger, IPaymentGateway, etc.)
   - BFFs inject custom implementations
   - Zero breaking changes to business logic

3. **GraphQL Flexibility**
   - Services are NOT tied to GraphQL
   - BFFs can use REST, gRPC, or any protocol
   - Shared schemas are optional, not mandatory

4. **Progressive Enhancement**
   - Start with shared library as-is
   - Add customizations incrementally
   - Override only what you need

5. **Zero Lock-in**
   - Each BFF controls its own API design
   - Shared library is a toolkit, not a framework
   - Can use 100%, 50%, or 10% of shared code

---

## 📊 Flexibility Matrix

| Feature | Shared Library Provides | BFF Can Customize |
|---------|------------------------|-------------------|
| **GraphQL Schema** | Base types, queries, mutations | ✅ Extend, ✅ Override, ✅ Replace |
| **GraphQL Resolvers** | Standard implementations | ✅ Wrap, ✅ Override, ✅ Replace |
| **Services** | Business logic functions | ✅ Wrap, ✅ Extend logic |
| **Core Logic** | Pure validation functions | ⚠️ Use as-is (no side effects) |
| **Logger** | Console logger | ✅ Replace (Winston, Pino, etc.) |
| **Storage** | In-memory store | ✅ Replace (Redis, PostgreSQL, etc.) |
| **Gateway** | HTTP & Mock gateways | ✅ Replace, ✅ Wrap, ✅ Multi-region |
| **Endpoints** | Default URLs | ✅ Override per environment |
| **Authentication** | None | ✅ Add (JWT, OAuth, etc.) |
| **Monitoring** | Basic logging | ✅ Add (Datadog, New Relic, etc.) |

---

## 🚀 Quick Start by Use Case

### "I want standard functionality"
```bash
# Use shared library as-is
import { createServices, payeeTypeDefs, makePayeeResolvers } from '@company/shared-graphql';
const services = createServices();
const schema = makeExecutableSchema({ 
  typeDefs: [payeeTypeDefs], 
  resolvers: makePayeeResolvers(services) 
});
```

### "I need to add mobile-specific features"
```bash
# Read: GRAPHQL_CUSTOMIZATION.md → Level 2: Extend Shared
# See: mobile-bff/src/custom-schema.ts
```

### "I need admin features for web"
```bash
# Read: GRAPHQL_CUSTOMIZATION.md → Scenario B: Add New Queries
# See: web-bff/src/custom-schema.ts
```

### "I need different endpoints per environment"
```bash
# Read: ENDPOINT_CUSTOMIZATION.md → Environment-Specific Configuration
# See: web-bff/src/custom-endpoints.ts
```

### "I need custom authentication"
```bash
# Read: BFF_EXTENSION_GUIDE.md → Pattern 3: Wrap Service
# See: web-bff/src/custom-endpoints.ts (createAuthenticatedGateway)
```

### "I need completely different API design"
```bash
# Read: GRAPHQL_CUSTOMIZATION.md → Level 3: Custom GraphQL
# See: mobile-bff/src/custom-schema.ts (mobileSimplifiedSchema)
```

---

## 📖 Documentation Index

| Document | Focus | Best For |
|----------|-------|----------|
| **[Architecture.md](./Architecture.md)** | Overall design, diagrams, pros/cons | Understanding the big picture |
| **[GRAPHQL_CUSTOMIZATION.md](./GRAPHQL_CUSTOMIZATION.md)** | GraphQL schemas & resolvers | BFFs with different API needs |
| **[BFF_EXTENSION_GUIDE.md](./BFF_EXTENSION_GUIDE.md)** | General BFF patterns | Service & infrastructure changes |
| **[ENDPOINT_CUSTOMIZATION.md](./ENDPOINT_CUSTOMIZATION.md)** | Downstream service URLs | Environment & region configs |
| **[EXTENSION_GUIDE.md](./shared-graphql/EXTENSION_GUIDE.md)** | Advanced patterns | Complex customizations |

---

## ✅ Summary

**Q: Can BFFs with different GraphQL demands use this design?**

**A: YES! The design supports THREE levels:**

1. **Use Shared As-Is** → Zero customization, fastest
2. **Extend Shared** → Add fields/queries, keep shared logic
3. **Custom GraphQL** → Completely different API, still use services

**Q: Can mobile and web have totally different APIs?**

**A: YES!** Mobile can use simplified schema, web can have rich admin features. They share business logic but control their own GraphQL layer.

**Q: What's the catch?**

**A: None!** Services are the foundation. GraphQL is just a thin layer. Use shared schemas if helpful, or write your own. Business logic stays consistent either way.

---

**🎯 Bottom Line:** This design gives you maximum flexibility at the GraphQL layer while keeping business logic consistent and tested. Start simple, customize as needed, no lock-in.
