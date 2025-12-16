# BFF Extension Guide

This guide shows how consumers (BFFs) can extend the shared library to meet their specific needs.

## 🎯 Extension Philosophy

The shared library provides **core functionality** that's common across all consumers. Each BFF can:

1. **Override dependencies** - Inject custom implementations
2. **Wrap services** - Add consumer-specific logic around shared services
3. **Extend GraphQL** - Add new fields, queries, mutations
4. **Use core directly** - Leverage pure functions for custom flows
5. **Compose services** - Mix shared and custom services

## 📱 Mobile BFF Extensions

### 1. Custom Logger with Analytics

```typescript
const mobileLogger: ILogger = {
  info: (message, meta) => {
    console.log(`[MOBILE] [INFO]`, message, meta);
    sendToAnalytics('info', message, meta); // Mobile-specific
  },
  // ... other methods
};

const services = createServices({ logger: mobileLogger });
```

**Use case:** Track all business events in mobile analytics (Firebase, Mixpanel, etc.)

### 2. Device-Based Caching

```typescript
const createMobileCachedDataSource = (baseDataSource) => ({
  fetchRegisteredName: async (accountNumber, bankCode) => {
    // Check device cache (AsyncStorage, SQLite)
    const cached = await checkDeviceCache(accountNumber, bankCode);
    if (cached) return cached;
    
    const result = await baseDataSource.fetchRegisteredName(accountNumber, bankCode);
    await saveToDeviceCache(accountNumber, bankCode, result);
    return result;
  }
});
```

**Use case:** Offline-first mobile apps that cache payee data on device

### 3. Wrapping Services with Mobile Context

```typescript
const mobilePayeeService = {
  ...baseServices.payeeService,
  
  validatePayeeWithDeviceContext: async (input, deviceInfo) => {
    const result = await baseServices.payeeService.validatePayee(input);
    return {
      ...result,
      deviceId: deviceInfo.deviceId,
      platform: deviceInfo.platform,
      biometricRequired: result.confidence < 0.9 // Mobile-specific logic
    };
  }
};
```

**Use case:** Add device metadata and determine if biometric auth is needed

### 4. Using Core Functions Directly

```typescript
async function mobileQuickValidation(accountNumber, bankCode, name) {
  // Lightweight validation before calling service
  const formatValid = validatePayee({ accountNumber, accountName: name, bankCode }, name);
  
  if (!formatValid.isValid) {
    return { quickCheck: 'FAILED', shouldCallService: false };
  }
  
  return { quickCheck: 'PASSED', shouldCallService: true };
}
```

**Use case:** Quick offline validation before network call (save bandwidth)

### 5. Extending GraphQL Schema

```typescript
const mobileTypeDefs = `
extend type ValidatePayeeResult {
  deviceId: String
  platform: String
  biometricRequired: Boolean
}

type QuickValidationResult {
  quickCheck: String!
  shouldCallService: Boolean!
}

extend type Query {
  quickValidatePayee(accountNumber: String!, bankCode: String!, name: String!): QuickValidationResult!
}

extend type Mutation {
  createPaymentWithBiometric(input: CreatePaymentInput!, biometricToken: String!): CreatePaymentResult!
}
`;
```

**Use case:** Add mobile-only queries/mutations and mobile-specific fields

## 🌐 Web BFF Extensions

### 1. Session-Aware Logging

```typescript
const createWebLogger = (sessionId?: string): ILogger => ({
  info: (message, meta) => {
    console.log(`[WEB] [SESSION:${sessionId}] [INFO]`, message, meta);
    // Could send to Sentry, Datadog, etc.
  }
});
```

**Use case:** Track all operations per user session for debugging and compliance

### 2. Redis-Backed Payment Store

```typescript
const createRedisPaymentStore = (): IPaymentStore => {
  const redisClient = createRedisClient();
  
  return {
    create: async (payload) => {
      const payment = { id: generateId(), ...payload };
      await redisClient.set(`payment:${payment.id}`, JSON.stringify(payment), 'EX', 3600);
      return payment;
    },
    // ... other methods
  };
};

const services = createServices({ 
  paymentStore: createRedisPaymentStore() 
});
```

**Use case:** Scalable web apps need distributed caching/storage

### 3. Audit Trail for Compliance

```typescript
const auditLog: AuditEvent[] = [];

function logAudit(action: string, userId: string, metadata: any) {
  auditLog.push({ timestamp: new Date().toISOString(), action, userId, metadata });
  // Could persist to database, send to audit service
}

const webPaymentService = {
  createPaymentWithFraudCheck: async (input, userId) => {
    logAudit('PAYMENT_ATTEMPT', userId, input);
    const result = await baseServices.paymentService.createPayment(input);
    logAudit(result.success ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED', userId, result);
    return result;
  }
};
```

**Use case:** Financial apps need complete audit trail for compliance

### 4. Rate Limiting & Fraud Detection

```typescript
function checkRateLimit(userId: string, limit: number, windowMs: number): boolean {
  const userRequests = rateLimitMap.get(userId) || [];
  const recentRequests = userRequests.filter(time => Date.now() - time < windowMs);
  
  if (recentRequests.length >= limit) {
    return false; // Rate limit exceeded
  }
  
  recentRequests.push(Date.now());
  rateLimitMap.set(userId, recentRequests);
  return true;
}

const createPaymentWithChecks = async (input, userId) => {
  if (!checkRateLimit(userId, 10, 60000)) {
    return { success: false, error: 'RATE_LIMIT_EXCEEDED' };
  }
  
  if (input.amount > 10000) {
    // High-value transaction - additional checks
    await triggerAdditionalVerification(userId);
  }
  
  return await baseServices.paymentService.createPayment(input);
};
```

**Use case:** Protect web API from abuse and detect suspicious patterns

### 5. Pagination & Batch Operations

```typescript
const webTypeDefs = `
type PaymentHistoryResult {
  payments: [Payment!]!
  total: Int!
  page: Int!
  hasMore: Boolean!
}

type BatchPaymentResult {
  successful: Int!
  failed: Int!
  results: [CreatePaymentResult!]!
}

extend type Query {
  paymentHistory(page: Int, limit: Int): PaymentHistoryResult!
}

extend type Mutation {
  createBatchPayments(inputs: [CreatePaymentInput!]!): BatchPaymentResult!
}
`;

const resolvers = {
  Query: {
    paymentHistory: async (_, { page, limit }, context) => {
      // Web-specific: paginated queries
      return await queryPaymentHistory(context.userId, page, limit);
    }
  },
  Mutation: {
    createBatchPayments: async (_, { inputs }, context) => {
      // Web-specific: batch operations
      const results = await Promise.all(
        inputs.map(input => createPayment(input, context.userId))
      );
      return { successful: results.filter(r => r.success).length, results };
    }
  }
};
```

**Use case:** Web dashboards need to display lists and perform bulk operations

## 🔧 Extension Patterns Summary

| Pattern | When to Use | Example |
|---------|-------------|---------|
| **Override Dependencies** | Need different infrastructure (Redis, Firebase, etc.) | Custom logger, custom storage |
| **Wrap Services** | Add logic before/after shared service calls | Audit trail, rate limiting, fraud detection |
| **Extend GraphQL** | Add consumer-specific fields/queries | Mobile-only biometric flow, web pagination |
| **Use Core Directly** | Custom business flows using shared logic | Quick validation, custom calculations |
| **Compose Services** | Mix shared and custom services | Shared validation + custom caching |

## 🎨 Best Practices

### ✅ DO

- **Inject dependencies** via `createServices({ overrides })`
- **Wrap services** to add your logic without modifying shared code
- **Extend GraphQL** with consumer-specific types
- **Use pure functions** from `core/` for custom flows
- **Document extensions** so other teams can learn from your patterns

### ❌ DON'T

- **Don't modify shared library code** for consumer-specific needs
- **Don't duplicate core logic** - import and reuse from `core/`
- **Don't tightly couple** to infrastructure - use ports/interfaces
- **Don't skip testing** - test your extensions thoroughly

## 📦 Example: Complete Extension

```typescript
// 1. Custom infrastructure
const customLogger = createCustomLogger();
const customStore = createCustomStore();

// 2. Create services with overrides
const baseServices = createServices({
  logger: customLogger,
  paymentStore: customStore
});

// 3. Wrap services with custom logic
const enhancedPaymentService = {
  ...baseServices.paymentService,
  
  createPaymentWithChecks: async (input, context) => {
    // Your custom logic
    await performCustomChecks(input, context);
    
    // Use shared service
    const result = await baseServices.paymentService.createPayment(input);
    
    // Post-processing
    await logToCustomSystem(result);
    
    return result;
  }
};

// 4. Extend GraphQL
const customTypeDefs = `
extend type Payment {
  customField: String
}

extend type Mutation {
  customPaymentFlow(input: CustomInput!): CustomResult!
}
`;

const customResolvers = {
  Mutation: {
    customPaymentFlow: async (_, { input }, context) => {
      return await enhancedPaymentService.createPaymentWithChecks(input, context);
    }
  }
};

// 5. Build final schema
const schema = makeExecutableSchema({
  typeDefs: [sharedTypeDefs, customTypeDefs],
  resolvers: [sharedResolvers, customResolvers]
});
```

## 🔍 Real-World Scenarios

### Scenario 1: Mobile App with Offline Support
- Override data sources with device storage
- Use core functions for offline validation
- Add mobile-specific GraphQL fields
- Sync when back online

### Scenario 2: Web Dashboard with Admin Features
- Add audit trail logging
- Implement pagination for large datasets
- Add batch operations for efficiency
- Extend with admin-only queries

### Scenario 3: Multi-Tenant SaaS
- Inject tenant-specific configuration
- Wrap services with tenant isolation
- Add tenant-specific business rules
- Extend with tenant management APIs

### Scenario 4: High-Security Banking App
- Add multi-factor authentication flows
- Implement comprehensive audit logging
- Add fraud detection layers
- Extend with risk assessment queries

## 📚 Further Reading

- See `mobile-bff/src/server.ts` for complete mobile examples
- See `web-bff/src/server.ts` for complete web examples
- See `shared-graphql/FUNCTIONAL_ARCHITECTURE.md` for architecture details
- See `Architecture.md` for system overview
