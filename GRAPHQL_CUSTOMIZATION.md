# GraphQL Schema & Resolver Customization Guide

This guide shows how BFFs can customize GraphQL schemas and resolvers while using the shared library.

## 🎯 Flexibility Levels

The design supports **three levels** of GraphQL customization:

### Level 1: Use Shared As-Is (Simplest)
- Import shared schemas and resolvers directly
- Zero customization
- Fastest to implement

### Level 2: Extend Shared (Recommended)
- Import shared schemas/resolvers as base
- Add BFF-specific fields, queries, mutations
- Keep shared functionality

### Level 3: Custom GraphQL (Maximum Flexibility)
- Use only shared **services** (not GraphQL layer)
- Write completely custom schemas and resolvers
- Full control over GraphQL API

---

## Level 1: Use Shared As-Is

**Use Case:** BFF wants standard GraphQL API with no customization

```typescript
// Simplest approach - use everything from shared library
import { 
  payeeTypeDefs, 
  paymentTypeDefs,
  makePayeeResolvers,
  makePaymentResolvers,
  createServices 
} from '@company/shared-graphql';

const services = createServices();

const schema = makeExecutableSchema({
  typeDefs: [payeeTypeDefs, paymentTypeDefs],
  resolvers: [
    makePayeeResolvers(services),
    makePaymentResolvers(services)
  ]
});
```

**Pros:** ✅ Fastest, ✅ Consistent across BFFs, ✅ Zero maintenance
**Cons:** ❌ No customization

---

## Level 2: Extend Shared Schemas

### Scenario A: Add New Fields to Existing Types

**Use Case:** Mobile BFF wants to add device-specific fields

```typescript
import { 
  payeeTypeDefs, 
  makePayeeResolvers,
  createServices 
} from '@company/shared-graphql';

// Extend shared types with new fields
const mobileExtensions = `
  extend type ValidatePayeeResult {
    deviceId: String
    platform: String
    biometricRequired: Boolean
    offlineCapable: Boolean
  }
`;

const services = createServices();
const baseResolvers = makePayeeResolvers(services);

// Wrap shared resolvers to add new fields
const mobileResolvers = {
  Query: {
    ...baseResolvers.Query,
    validatePayee: async (parent, args, context) => {
      // Call shared resolver
      const baseResult = await baseResolvers.Query.validatePayee(parent, args, context);
      
      // Add mobile-specific fields
      return {
        ...baseResult,
        deviceId: context.deviceId,
        platform: context.platform,
        biometricRequired: baseResult.confidence < 0.9,
        offlineCapable: true
      };
    }
  }
};

const schema = makeExecutableSchema({
  typeDefs: [payeeTypeDefs, mobileExtensions],
  resolvers: mobileResolvers
});
```

**Pros:** ✅ Reuses shared logic, ✅ Adds BFF-specific data
**Cons:** ⚠️ Must maintain field additions

---

### Scenario B: Add New Queries/Mutations

**Use Case:** Web BFF needs admin queries not in shared library

```typescript
import { 
  payeeTypeDefs,
  paymentTypeDefs,
  makePayeeResolvers,
  makePaymentResolvers,
  createServices 
} from '@company/shared-graphql';

// Add new queries and types
const webAdminExtensions = `
  type PaymentStats {
    totalAmount: Float!
    count: Int!
    avgAmount: Float!
    successRate: Float!
  }

  type AuditLog {
    timestamp: String!
    userId: String!
    action: String!
    details: String
  }

  extend type Query {
    # Admin-only queries
    getPaymentStats(fromDate: String!, toDate: String!): PaymentStats!
    getAuditLogs(userId: String, limit: Int): [AuditLog!]!
    
    # Batch operations
    validatePayeeBatch(inputs: [ValidatePayeeInput!]!): [ValidatePayeeResult!]!
  }

  extend type Mutation {
    # Admin operations
    reconcilePayments(date: String!): ReconcileResult!
  }
`;

const services = createServices();
const basePayeeResolvers = makePayeeResolvers(services);
const basePaymentResolvers = makePaymentResolvers(services);

const webResolvers = {
  Query: {
    // Include all shared queries
    ...basePayeeResolvers.Query,
    ...basePaymentResolvers.Query,
    
    // Add web-specific queries
    getPaymentStats: async (_, { fromDate, toDate }, context) => {
      // Web-specific implementation
      const stats = await calculatePaymentStats(fromDate, toDate);
      return stats;
    },
    
    getAuditLogs: async (_, { userId, limit = 100 }, context) => {
      // Web-specific implementation
      return await fetchAuditLogs(userId, limit);
    },
    
    validatePayeeBatch: async (_, { inputs }, context) => {
      // Reuse shared service for batch
      return await Promise.all(
        inputs.map(input => services.payeeService.validatePayee(input))
      );
    }
  },
  
  Mutation: {
    // Include all shared mutations
    ...basePaymentResolvers.Mutation,
    
    // Add web-specific mutations
    reconcilePayments: async (_, { date }, context) => {
      // Web-specific implementation
      return await performReconciliation(date);
    }
  }
};

const schema = makeExecutableSchema({
  typeDefs: [payeeTypeDefs, paymentTypeDefs, webAdminExtensions],
  resolvers: webResolvers
});
```

**Pros:** ✅ Shared functionality preserved, ✅ BFF-specific features added
**Cons:** ⚠️ Must implement new resolvers

---

### Scenario C: Modify Shared Resolvers

**Use Case:** Mobile BFF needs different validation logic for mobile users

```typescript
import { 
  paymentTypeDefs,
  makePaymentResolvers,
  createServices 
} from '@company/shared-graphql';

const services = createServices();
const baseResolvers = makePaymentResolvers(services);

const mobileResolvers = {
  Query: {
    ...baseResolvers.Query
  },
  
  Mutation: {
    // Keep other mutations
    ...baseResolvers.Mutation,
    
    // Override specific mutation with mobile-specific logic
    createPayment: async (parent, { input }, context) => {
      // Mobile-specific: Check biometric first
      if (!context.biometricVerified) {
        return { success: false, error: 'BIOMETRIC_REQUIRED' };
      }
      
      // Mobile-specific: Lower limits for mobile
      if (input.amount > 5000) {
        return { success: false, error: 'AMOUNT_EXCEEDS_MOBILE_LIMIT' };
      }
      
      // Call shared service after mobile-specific checks
      return await services.paymentService.createPayment(input);
    }
  }
};

const schema = makeExecutableSchema({
  typeDefs: [paymentTypeDefs],
  resolvers: mobileResolvers
});
```

**Pros:** ✅ Full control over behavior, ✅ Reuses shared service
**Cons:** ⚠️ Divergence from shared behavior

---

## Level 3: Completely Custom GraphQL

### Scenario: BFF Has Totally Different API Design

**Use Case:** Mobile BFF uses simplified schema for mobile clients

```typescript
import { createServices } from '@company/shared-graphql';

// Completely custom schema (not extending shared)
const mobileCustomSchema = `
  # Simplified types for mobile
  type MobilePayee {
    id: ID!
    name: String!
    accountNumber: String!
    isValid: Boolean!
    canPay: Boolean!
  }

  type MobilePayment {
    id: ID!
    amount: Float!
    status: String!
    timestamp: String!
  }

  # Mobile-optimized queries
  type Query {
    # Simpler query names for mobile
    checkPayee(account: String!): MobilePayee!
    myPayments(limit: Int): [MobilePayment!]!
  }

  # Mobile-optimized mutations
  type Mutation {
    # Single simplified payment mutation
    pay(to: String!, amount: Float!): MobilePayment!
  }
`;

// Use shared services, but custom resolvers
const services = createServices();

const mobileResolvers = {
  Query: {
    checkPayee: async (_, { account }, context) => {
      // Use shared service but transform to mobile format
      const result = await services.payeeService.validatePayee({
        accountNumber: account,
        accountName: context.userName || '',
        bankCode: context.bankCode || '001'
      });
      
      return {
        id: account,
        name: result.suggestedName || 'Unknown',
        accountNumber: account,
        isValid: result.isValid,
        canPay: result.isValid && result.confidence > 0.8
      };
    },
    
    myPayments: async (_, { limit = 10 }, context) => {
      // Custom implementation using shared services
      const payments = await getPaymentsForUser(context.userId, limit);
      return payments.map(p => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        timestamp: p.createdAt
      }));
    }
  },
  
  Mutation: {
    pay: async (_, { to, amount }, context) => {
      // Use shared service with custom wrapper
      const result = await services.paymentService.createPayment({
        amount,
        currency: 'USD',
        fromAccount: context.userAccount,
        toAccount: to
      });
      
      if (!result.success) {
        throw new Error(result.reason || 'Payment failed');
      }
      
      return {
        id: result.paymentId,
        amount,
        status: 'COMPLETED',
        timestamp: new Date().toISOString()
      };
    }
  }
};

const schema = makeExecutableSchema({
  typeDefs: [mobileCustomSchema],
  resolvers: mobileResolvers
});
```

**Pros:** ✅ Complete control, ✅ Optimized for client needs, ✅ Still reuses business logic
**Cons:** ⚠️ No shared schema benefits, ⚠️ Must maintain completely

---

## 🎨 Real-World Examples

### Example 1: Mobile App (Simplified Schema)

```typescript
// mobile-bff uses custom schema optimized for mobile bandwidth
const mobileSchema = `
  type QuickPayee {
    account: String!
    valid: Boolean!
  }

  type Query {
    quickCheck(account: String!): QuickPayee!
  }
`;

// Still uses shared validation service
const resolver = {
  Query: {
    quickCheck: async (_, { account }) => {
      const result = await services.payeeService.validatePayee({
        accountNumber: account,
        accountName: '',
        bankCode: '001'
      });
      return { account, valid: result.isValid };
    }
  }
};
```

### Example 2: Web Dashboard (Rich Schema)

```typescript
// web-bff uses extended schema with analytics
const webSchema = `
  ${payeeTypeDefs}
  ${paymentTypeDefs}

  type PaymentAnalytics {
    dailyTotal: Float!
    successRate: Float!
    topPayees: [Payee!]!
    riskScore: Float!
  }

  extend type Query {
    analytics(date: String!): PaymentAnalytics!
  }
`;

// Uses shared resolvers + custom analytics
const webResolvers = {
  Query: {
    ...makePayeeResolvers(services).Query,
    ...makePaymentResolvers(services).Query,
    analytics: async (_, { date }) => {
      // Custom web-only analytics
      return await calculateAnalytics(date);
    }
  }
};
```

### Example 3: Admin Portal (Completely Custom)

```typescript
// admin-bff has completely different schema for admin operations
const adminSchema = `
  type SystemStats {
    activeUsers: Int!
    totalTransactions: Int!
    systemHealth: String!
  }

  type Query {
    systemStats: SystemStats!
    allPayments(page: Int!): [Payment!]!
  }

  type Mutation {
    suspendUser(userId: String!): Boolean!
  }
`;

// Uses shared services but totally different GraphQL API
const adminResolvers = {
  Query: {
    systemStats: async () => {
      // Admin-specific queries using shared services internally
      return await getSystemStats();
    },
    allPayments: async (_, { page }) => {
      // Uses shared service for data access
      return await services.paymentService.getAllPayments(page);
    }
  }
};
```

---

## 📊 Comparison Matrix

| Approach | Shared Schema | Shared Resolvers | Shared Services | Customization | Maintenance |
|----------|---------------|------------------|-----------------|---------------|-------------|
| **Use As-Is** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ None | ✅ Lowest |
| **Extend Schema** | ✅ Yes | ⚠️ Wrap | ✅ Yes | ⚠️ Medium | ⚠️ Medium |
| **Custom GraphQL** | ❌ No | ❌ No | ✅ Yes | ✅ Full | ❌ Highest |

---

## 🎯 Decision Framework

### Use Shared Schema When:
- ✅ Standard API is sufficient
- ✅ Want consistency across BFFs
- ✅ Minimize maintenance

### Extend Shared Schema When:
- ✅ Need BFF-specific fields
- ✅ Want to add queries/mutations
- ✅ Keep shared functionality

### Custom GraphQL When:
- ✅ Completely different API design needed
- ✅ Client has unique requirements (mobile simplicity)
- ✅ Legacy API compatibility required

---

## 🔑 Key Design Principles

1. **Services are the Foundation**: GraphQL is just a thin layer over services
2. **Mix and Match**: Use shared services with custom GraphQL freely
3. **No Lock-in**: BFFs can evolve their GraphQL independently
4. **Shared Business Logic**: Core validation always shared (in `core/`)
5. **BFF Autonomy**: Each team controls their GraphQL API

---

## 💡 Best Practices

### ✅ DO:
- Reuse shared services even with custom GraphQL
- Keep business logic in shared `core/` functions
- Document your schema extensions
- Use GraphQL schema stitching for complex cases

### ❌ DON'T:
- Duplicate business logic in custom resolvers
- Break type safety by returning wrong shapes
- Create incompatible APIs unless necessary
- Ignore shared schema updates that affect you

---

## 🚀 Implementation Template

```typescript
// Template for any BFF customization level
import { createServices } from '@company/shared-graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';

// 1. Define your schema (shared, extended, or custom)
const typeDefs = `
  # Your schema here
`;

// 2. Create shared services
const services = createServices({
  // Your overrides here
});

// 3. Define resolvers (reusing or custom)
const resolvers = {
  Query: {
    // Your queries here - can use services
  },
  Mutation: {
    // Your mutations here - can use services
  }
};

// 4. Create schema
const schema = makeExecutableSchema({ typeDefs, resolvers });

// 5. Use with your GraphQL server
const server = new ApolloServer({ schema });
```

---

## 📚 See Also

- **Real implementations**: 
  - `mobile-bff/src/server.ts` - Extended schema example
  - `web-bff/src/server.ts` - Extended schema with admin features
- **Shared library**: `shared-graphql/src/graphql/` - Base schemas and resolvers
- **Services**: `shared-graphql/src/services/` - Business logic layer
