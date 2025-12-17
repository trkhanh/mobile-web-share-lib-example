# OOP Architecture - Schema and Gateway Customization

## Overview

This implementation demonstrates how the **OOP branch** supports different schemas and gateway behaviors for Mobile and Web BFFs while maintaining SOLID principles and code reusability.

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                     Shared GraphQL Library                   │
│  (OOP: Classes, Interfaces, Dependency Injection)           │
│                                                              │
│  ├─ Base Schema (payee-schema.ts)                          │
│  ├─ Base Resolvers (payee-resolvers.ts)                    │
│  ├─ Services (PaymentService, PayeeService)                │
│  └─ Infrastructure (HttpPaymentGateway, etc.)              │
└─────────────────────────────────────────────────────────────┘
                        ▲              ▲
                        │              │
        ┌───────────────┘              └───────────────┐
        │                                              │
┌───────▼─────────┐                          ┌────────▼────────┐
│  Mobile BFF     │                          │   Web BFF       │
│  (Port 4001)    │                          │   (Port 4002)   │
├─────────────────┤                          ├─────────────────┤
│ SCHEMA:         │                          │ SCHEMA:         │
│ • Base Schema   │                          │ • Base Schema   │
│ • + Mobile Ext  │                          │ • + Web Ext     │
│                 │                          │                 │
│ GATEWAY:        │                          │ GATEWAY:        │
│ • 4 Decorators  │                          │ • 5 Decorators  │
│   1. Headers    │                          │   1. Auth       │
│   2. Optimize   │                          │   2. Tracing    │
│   3. Errors     │                          │   3. Enrich     │
│   4. Retry      │                          │   4. Errors     │
│                 │                          │   5. Retry      │
└─────────────────┘                          └─────────────────┘
```

## 1. Schema Customization (Open/Closed Principle)

### Problem
Mobile and Web BFFs need different GraphQL schemas:
- **Mobile**: Bandwidth-optimized, offline-capable, minimal payloads
- **Web**: Rich metadata, audit trails, admin operations, compliance data

### OOP Solution: Schema Extension Pattern

Both BFFs **extend** the base schema without **modifying** it:

```typescript
// Base Schema (shared-graphql/src/graphql/payee-schema.ts)
export const payeeTypeDefs = `
  type ValidatePayeeResult {
    isValid: Boolean!
    confidence: Float!
    matchLevel: MatchLevel!
    suggestedName: String
  }
`;

// Mobile Extension (mobile-bff/src/custom-schema.ts)
export const mobileSchemaExtensions = `
  extend type ValidatePayeeResult {
    mobileOptimizedPayload: String!  # Compressed for bandwidth
    offlineCapable: Boolean!          # Can cache?
    cacheTTL: Int!                    # Cache duration
    estimatedDataUsageKB: Float!      # Data usage estimate
  }
`;

// Web Extension (web-bff/src/custom-schema.ts)
export const webSchemaExtensions = `
  extend type ValidatePayeeResult {
    validationId: ID!                 # Tracking ID
    auditLog: AuditLog!               # Complete audit trail
    metadata: ValidationMetadata!     # Rich metadata
    complianceInfo: ComplianceInfo    # Regulatory info
    matchAnalysis: MatchAnalysis!     # Debug details
  }
`;
```

### SOLID Principles Applied

1. **Single Responsibility Principle (SRP)**
   - Base schema: Core business entities only
   - Mobile extension: Mobile-specific concerns only
   - Web extension: Web-specific concerns only

2. **Open/Closed Principle (OCP)**
   - Base schema is **closed for modification**
   - Each BFF **opens it for extension** via GraphQL `extend`
   - No changes to shared library required

3. **Dependency Inversion Principle (DIP)**
   - BFFs depend on base schema abstraction
   - Extensions don't break base functionality
   - Services work with base types, resolvers add extensions

### Usage Example

```graphql
# Mobile Query (bandwidth-optimized)
query ValidatePayeeMobile($input: ValidatePayeeInput!) {
  validatePayee(input: $input) {
    isValid
    confidence
    mobileOptimizedPayload  # Mobile-only field
    cacheTTL                 # Mobile-only field
  }
}

# Web Query (rich metadata)
query ValidatePayeeWeb($input: ValidatePayeeInput!) {
  validatePayee(input: $input) {
    isValid
    confidence
    validationId             # Web-only field
    auditLog {               # Web-only field
      userId
      timestamp
    }
    complianceInfo {         # Web-only field
      status
    }
  }
}
```

## 2. Gateway Customization (Decorator Pattern)

### Problem
Mobile and Web BFFs need different downstream communication behaviors:
- **Mobile**: Device headers, fast retries, simple errors, optimization
- **Web**: JWT auth, tracing, enrichment, detailed errors, patient retries

### OOP Solution: Decorator Pattern + Factory

Each concern is a **separate class** (decorator) that wraps the base gateway:

```typescript
// Mobile Gateway Stack (4 layers)
MobileRetryGateway
  ↓ wraps
MobileErrorHandlingGateway
  ↓ wraps
MobileOptimizedGateway
  ↓ wraps
MobileHeaderGateway
  ↓ wraps
HttpPaymentGateway (base)

// Web Gateway Stack (5 layers)
WebRetryGateway
  ↓ wraps
WebErrorHandlingGateway
  ↓ wraps
WebEnrichedGateway
  ↓ wraps
TracedGateway
  ↓ wraps
AuthenticatedGateway
  ↓ wraps
HttpPaymentGateway (base)
```

### SOLID Principles Applied

1. **Single Responsibility Principle (SRP)**
   ```typescript
   // Each decorator has ONE responsibility
   class MobileHeaderGateway {
     // ONLY adds mobile headers
   }
   
   class MobileOptimizedGateway {
     // ONLY optimizes responses
   }
   
   class MobileErrorHandlingGateway {
     // ONLY handles errors
   }
   
   class MobileRetryGateway {
     // ONLY implements retry logic
   }
   ```

2. **Open/Closed Principle (OCP)**
   ```typescript
   // Base gateway is CLOSED for modification
   class HttpPaymentGateway implements IPaymentGateway {
     // Original implementation never changes
   }
   
   // Extended through decoration, not inheritance
   class MobileHeaderGateway implements IPaymentGateway {
     constructor(private base: IPaymentGateway) {}
     // Wraps base, adds headers
   }
   ```

3. **Liskov Substitution Principle (LSP)**
   ```typescript
   // All decorators implement same interface
   interface IPaymentGateway {
     authorize(...): Promise<AuthorizationResult>;
     capture(...): Promise<CaptureResult>;
     refund(...): Promise<RefundResult>;
   }
   
   // PaymentService depends on interface, not concrete class
   class PaymentService {
     constructor(private gateway: IPaymentGateway) {}
     // Works with ANY implementation
   }
   ```

4. **Interface Segregation Principle (ISP)**
   ```typescript
   // Interface is minimal - only what's needed
   interface IPaymentGateway {
     authorize(...): Promise<AuthorizationResult>;
     capture(...): Promise<CaptureResult>;
     refund(...): Promise<RefundResult>;
   }
   // No bloated interface with methods you don't use
   ```

5. **Dependency Inversion Principle (DIP)**
   ```typescript
   // High-level module (Service) depends on abstraction
   class PaymentService {
     constructor(
       private gateway: IPaymentGateway  // Abstraction
     ) {}
   }
   
   // Low-level module (Gateway) implements abstraction
   class HttpPaymentGateway implements IPaymentGateway {
     // Concrete implementation
   }
   ```

### Implementation Details

#### Mobile BFF Gateway (mobile-bff/src/custom-gateway.ts)

```typescript
// 1. Headers Decorator
export class MobileHeaderGateway implements IPaymentGateway {
  constructor(
    private baseGateway: IPaymentGateway,
    private context: MobileContext
  ) {}
  
  async authorize(...) {
    // Add mobile headers: device ID, platform, app version
    return this.baseGateway.authorize(...);
  }
}

// 2. Optimization Decorator
export class MobileOptimizedGateway implements IPaymentGateway {
  constructor(private baseGateway: IPaymentGateway) {}
  
  async authorize(...) {
    const startTime = Date.now();
    const result = await this.baseGateway.authorize(...);
    // Log processing time, optimize payload
    return result;
  }
}

// 3. Error Handling Decorator
export class MobileErrorHandlingGateway implements IPaymentGateway {
  constructor(private baseGateway: IPaymentGateway) {}
  
  async authorize(...) {
    try {
      return await this.baseGateway.authorize(...);
    } catch (error) {
      // Map to MobileError (simple, actionable)
      throw this.mapToMobileError(error);
    }
  }
}

// 4. Retry Decorator
export class MobileRetryGateway implements IPaymentGateway {
  constructor(private baseGateway: IPaymentGateway) {}
  
  async authorize(...) {
    // Fast retry: 2 attempts, 500ms-2s delays
    return this.retryWithBackoff(() => 
      this.baseGateway.authorize(...)
    );
  }
}

// Factory creates complete stack
export class CompleteMobileGatewayFactory {
  static create(context: MobileContext): IPaymentGateway {
    const base = new HttpPaymentGateway(url);
    const withHeaders = new MobileHeaderGateway(base, context);
    const withOptimization = new MobileOptimizedGateway(withHeaders);
    const withErrorHandling = new MobileErrorHandlingGateway(withOptimization);
    const withRetry = new MobileRetryGateway(withErrorHandling);
    return withRetry; // Returns IPaymentGateway interface
  }
}
```

#### Web BFF Gateway (web-bff/src/custom-gateway.ts)

```typescript
// 1. Authentication Decorator
export class AuthenticatedGateway implements IPaymentGateway {
  constructor(
    private baseGateway: IPaymentGateway,
    private getUserToken: () => Promise<string>
  ) {}
  
  async authorize(...) {
    const token = await this.getUserToken();
    // Add JWT token to headers
    return this.baseGateway.authorize(...);
  }
}

// 2. Tracing Decorator
export class TracedGateway implements IPaymentGateway {
  constructor(
    private baseGateway: IPaymentGateway,
    private context: WebContext
  ) {}
  
  async authorize(...) {
    const traceId = generateTraceId();
    // Add correlation ID, session ID, trace headers
    return this.baseGateway.authorize(...);
  }
}

// 3. Enrichment Decorator
export class WebEnrichedGateway implements IPaymentGateway {
  constructor(
    private baseGateway: IPaymentGateway,
    private context: WebContext
  ) {}
  
  async authorize(...) {
    const result = await this.baseGateway.authorize(...);
    // Log audit info, add metadata
    return result;
  }
}

// 4. Error Handling Decorator
export class WebErrorHandlingGateway implements IPaymentGateway {
  constructor(
    private baseGateway: IPaymentGateway,
    private getRequestId: () => string
  ) {}
  
  async authorize(...) {
    try {
      return await this.baseGateway.authorize(...);
    } catch (error) {
      // Map to WebError (detailed, debuggable)
      throw this.mapToWebError(error);
    }
  }
}

// 5. Retry Decorator
export class WebRetryGateway implements IPaymentGateway {
  constructor(private baseGateway: IPaymentGateway) {}
  
  async authorize(...) {
    // Patient retry: 3 attempts, 1s-10s delays
    return this.retryWithBackoff(() => 
      this.baseGateway.authorize(...)
    );
  }
}

// Factory creates complete stack
export class CompleteWebGatewayFactory {
  static create(
    context: WebContext,
    getUserToken: () => Promise<string>,
    getRequestId: () => string
  ): IPaymentGateway {
    const base = new HttpPaymentGateway(url);
    const withAuth = new AuthenticatedGateway(base, getUserToken);
    const withTracing = new TracedGateway(withAuth, context);
    const withEnrichment = new WebEnrichedGateway(withTracing, context);
    const withErrorHandling = new WebErrorHandlingGateway(withEnrichment, getRequestId);
    const withRetry = new WebRetryGateway(withErrorHandling);
    return withRetry; // Returns IPaymentGateway interface
  }
}
```

## 3. Complete Integration

### Mobile BFF (mobile-bff/src/server.ts)

```typescript
import { CompleteMobileGatewayFactory, MobileContext } from './custom-gateway';
import { completeMobileSchema } from './custom-schema';

// 1. Create mobile context
const mobileContext: MobileContext = {
  deviceId: 'device-123',
  platform: 'iOS',
  appVersion: '2.1.0',
  userId: 'user-123',
  biometricEnabled: true
};

// 2. Create gateway with all mobile customizations
const gateway = CompleteMobileGatewayFactory.create(mobileContext);

// 3. Inject into services (Dependency Injection)
const services = createServices({ paymentGateway: gateway });

// 4. Create schema with mobile extensions
const schema = makeExecutableSchema({
  typeDefs: completeMobileSchema, // Base + Mobile extensions
  resolvers: mobileResolvers
});
```

### Web BFF (web-bff/src/server.ts)

```typescript
import { CompleteWebGatewayFactory, WebContext } from './custom-gateway';
import { completeWebSchema } from './custom-schema';

// 1. Create web context
const webContext: WebContext = {
  userId: 'admin-123',
  sessionId: 'session-456',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0',
  correlationId: 'corr-789'
};

// 2. Create gateway with all web customizations
const gateway = CompleteWebGatewayFactory.create(
  webContext,
  getUserToken,
  getRequestId
);

// 3. Inject into services (Dependency Injection)
const services = createServices({ paymentGateway: gateway });

// 4. Create schema with web extensions
const schema = makeExecutableSchema({
  typeDefs: completeWebSchema, // Base + Web extensions
  resolvers: webResolvers
});
```

## 4. Benefits of OOP Approach

### Testability
```typescript
// Test each decorator in isolation
describe('MobileHeaderGateway', () => {
  it('adds mobile headers', async () => {
    const mockBase = createMock<IPaymentGateway>();
    const gateway = new MobileHeaderGateway(mockBase, context);
    
    await gateway.authorize(...);
    
    expect(mockBase.authorize).toHaveBeenCalledWith(...);
  });
});
```

### Flexibility
```typescript
// Easy to add/remove decorators
const gateway = new MobileRetryGateway(
  // Remove error handling for testing
  new MobileOptimizedGateway(
    new MobileHeaderGateway(base, context)
  )
);
```

### Maintainability
```typescript
// Each class is small and focused
class MobileHeaderGateway {
  // 50 lines - ONLY header logic
}

class MobileOptimizedGateway {
  // 40 lines - ONLY optimization logic
}

// vs. Monolithic class with 500+ lines
```

### Extensibility
```typescript
// Add new decorator without modifying existing code
class CachingGateway implements IPaymentGateway {
  constructor(private base: IPaymentGateway) {}
  
  async authorize(...) {
    const cached = await this.cache.get(...);
    if (cached) return cached;
    
    const result = await this.base.authorize(...);
    await this.cache.set(..., result);
    return result;
  }
}

// Use it anywhere in the chain
const gateway = new MobileRetryGateway(
  new CachingGateway(  // New decorator
    new MobileErrorHandlingGateway(
      new MobileOptimizedGateway(
        new MobileHeaderGateway(base, context)
      )
    )
  )
);
```

## 5. Comparison: OOP vs Functional

| Aspect | OOP (this branch) | Functional (FunctionalProgramming branch) |
|--------|-------------------|------------------------------------------|
| **Pattern** | Decorator Pattern (classes) | Higher-Order Functions (closures) |
| **Composition** | `new Decorator(base)` | `createDecorator(base)` |
| **State** | Instance properties | Closure variables |
| **Testing** | Mock classes | Mock functions |
| **Type Safety** | Class implements interface | Function returns interface |
| **Readability** | Familiar OOP pattern | Functional composition |

Both approaches achieve the same SOLID principles, just with different paradigms.

## 6. Running the Examples

```bash
# Start both BFFs
cd mobile-bff && npm start  # Port 4001
cd web-bff && npm start     # Port 4002

# Run E2E tests
cd playwright-e2e
npm test gateway-customization.spec.ts
```

## 7. Key Takeaways

1. **Schema Customization**: Use GraphQL `extend` to add BFF-specific fields without modifying base schema (Open/Closed Principle)

2. **Gateway Customization**: Use Decorator Pattern to add behaviors without modifying base gateway (Open/Closed Principle)

3. **SOLID Principles**: Each decorator has one responsibility (SRP), depends on abstractions (DIP), and can be substituted (LSP)

4. **Testability**: Each decorator can be tested in isolation with mocks

5. **Flexibility**: Easy to add/remove/reorder decorators without breaking existing code

6. **Maintainability**: Small, focused classes are easier to understand and maintain than monolithic implementations

This architecture demonstrates how **OOP principles** enable **flexible, maintainable, and testable** code while supporting **different requirements** for Mobile and Web BFFs.
