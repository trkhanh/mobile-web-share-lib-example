# Functional vs OOP Architecture Guide

This library uses a **functional-first approach** with OOP only where it provides clear benefits.

## 📐 Architecture Layers

**100% Functional - No Classes Anywhere!**

This codebase is fully functional from top to bottom. Even infrastructure uses factory functions instead of classes.

### Layer 1: Pure Business Logic (100% Functional)
**Location:** `src/core/*`

Pure functions with **zero dependencies** on infrastructure:
- `core/payee-validation.ts` - Name similarity, account format validation
- `core/payment-validation.ts` - Amount validation, status determination

**Why functional:**
- Easy to test (no mocks needed)
- Easy to understand (deterministic)
- Easy to compose (function composition)
- Portable across any environment

```typescript
// Example: Pure function
export const calculateNameSimilarity = (name1: string, name2: string): number => {
  // Pure computation - same inputs always produce same output
  // No side effects, no dependencies
};
```

### Layer 2: Service Layer (Functional Factories)
**Location:** `src/services/*-functional.ts`

Services use **functional factory pattern** instead of classes:
- `services/payee-service-functional.ts`
- `services/payment-service-functional.ts`

**Why functional factories:**
- Simpler than classes (no `new`, `this`, inheritance)
- Explicit dependencies via parameters
- Returns object with methods (closure pattern)
- Easy to test with dependency injection

```typescript
// Functional factory pattern
export const createPayeeService = (deps: PayeeServiceDeps) => {
  const { dataSource, logger } = deps;
  
  return {
    validatePayee: async (input) => {
      // Uses pure functions from core/
      const result = validatePayee(...);
      return result;
    }
  };
};
```

**vs Class approach (NOT used):**
```typescript
// Class approach - more ceremony, less flexible
export class PayeeService {
  constructor(
    private dataSource: IPayeeDataSource,
    private logger: ILogger
  ) {}
  
  async validatePayee(input: ValidatePayeeInput) {
    // Same logic but with class boilerplate
  }
}
```

### Layer 3: GraphQL Resolvers (100% Functional)
**Location:** `src/graphql/*-resolvers.ts`

Resolvers are **naturally functional** - they're just functions:

```typescript
// Functional resolver composition
export const makePayeeResolvers = (services: SharedServices) => {
  return {
    Query: {
      validatePayee: async (_, { input }) => {
        return await services.payeeService.validatePayee(input);
      }
    }
  };
};
```

**Why functional:**
- GraphQL resolvers ARE functions by design
- No state needed
- Simple composition pattern

### Layer 4: Infrastructure (Functional Factories)
**Location:** `src/infra/*-functional.ts`

Even infrastructure uses **functional factory pattern** instead of classes:
- `infra/console-logger-functional.ts`
- `infra/http-gateway-functional.ts`
- `infra/mock-gateway-functional.ts`
- `infra/in-memory-payment-store-functional.ts`
- etc.

**Why functional for infra:**
- Simpler API (no `new` keyword needed)
- Closure for private state (no `private` fields)
- Easy to swap implementations
- Consistent pattern across entire codebase

```typescript
// Functional factory for HTTP client - uses closure for config
export const createHttpPayeeDataSource = (baseUrl: string): IPayeeDataSource => {
  // Private helper in closure
  const post = async (path, body) => {
    // HTTP logic
  };
  
  return {
    fetchRegisteredName: async (accountNumber, bankCode) => {
      // Uses baseUrl from closure
      return await post('/api/lookup', { accountNumber, bankCode });
    }
  };
};

// Usage - simple function call, no "new"
const dataSource = createHttpPayeeDataSource('http://localhost:8080');
```

## 🎯 100% Functional Approach

### This codebase is 100% functional:
✅ **Business logic** - Pure functions in `core/`  
✅ **Services** - Functional factories with closure pattern  
✅ **Resolvers** - Pure function composition  
✅ **Infrastructure** - Functional factories (no classes!)  

### Why no classes at all?
- **Simpler** - No `new`, `this`, `extends`, `super`
- **Explicit** - Dependencies passed as parameters
- **Testable** - Easy to inject test doubles
- **Consistent** - Same pattern everywhere
- **Modern** - Aligns with React hooks, functional paradigms  

## 📊 Benefits of This Approach

### 1. Testing is Simpler
```typescript
// Pure functions - no mocks needed
test('validatePayeeName returns valid for exact match', () => {
  const result = validatePayeeName('John Doe', 'John Doe');
  expect(result.isValid).toBe(true);
  expect(result.confidence).toBe(1);
});

// Functional services - inject simple test doubles
test('payeeService validates successfully', async () => {
  const service = createPayeeService({
    dataSource: { fetchRegisteredName: async () => 'John Doe' },
    logger: { info: () => {}, error: () => {} }
  });
  
  const result = await service.validatePayee({
    accountNumber: '12345678',
    accountName: 'John Doe',
    bankCode: '010'
  });
  
  expect(result.isValid).toBe(true);
});
```

### 2. Composition is Easier
```typescript
// Compose pure functions
export const validatePayee = (account, bank, inputName, regName) => {
  const accountValid = validateAccountNumberFormat(account, bank);
  const nameValid = validatePayeeName(inputName, regName);
  return combineResults(accountValid, nameValid);
};
```

### 3. Code is More Maintainable
- Business logic in `core/` has zero dependencies
- Services are thin orchestration layers
- Changes to infrastructure don't affect business logic
- Easy to understand control flow (no hidden state)

## 🔄 Complete Refactoring Summary

### What Was Refactored (100% Functional Now):

**Services Layer:**
- ❌ `services/payment-service.ts` (class) → ✅ `services/payment-service-functional.ts` (factory)
- ❌ `services/payee-service.ts` (class) → ✅ `services/payee-service-functional.ts` (factory)

**Infrastructure Layer:**
- ❌ `infra/console-logger.ts` (class) → ✅ `infra/console-logger-functional.ts` (factory)
- ❌ `infra/http-gateway.ts` (class) → ✅ `infra/http-gateway-functional.ts` (factory)
- ❌ `infra/mock-gateway.ts` (class) → ✅ `infra/mock-gateway-functional.ts` (factory)
- ❌ `infra/in-memory-payment-store.ts` (class) → ✅ `infra/in-memory-payment-store-functional.ts` (factory)
- ❌ `infra/http-payee-data-source.ts` (class) → ✅ `infra/http-payee-data-source-functional.ts` (factory)
- ❌ `infra/mock-payee-data-source.ts` (class) → ✅ `infra/mock-payee-data-source-functional.ts` (factory)

**Core Business Logic:**
- ✅ `core/payee-validation.ts` (pure functions) - NEW
- ✅ `core/payment-validation.ts` (pure functions) - NEW

**Result:** Zero classes in the entire codebase!

### Before (OOP):
```typescript
// Class with dependencies
export class PayeeService {
  constructor(
    private dataSource: IPayeeDataSource,
    private logger: ILogger
  ) {}
  
  async validatePayee(input: ValidatePayeeInput) {
    const registeredName = await this.dataSource.fetchRegisteredName(...);
    const similarity = this.calculateSimilarity(input.accountName, registeredName);
    // Business logic mixed with orchestration
  }
  
  private calculateSimilarity(a: string, b: string): number {
    // Buried in class - hard to test independently
  }
}

// Usage - requires "new" keyword
const service = new PayeeService(dataSource, logger);
```

### After (Functional):
```typescript
// Pure business logic (core/)
export const calculateNameSimilarity = (a: string, b: string): number => {
  // Easy to test, compose, understand
};

// Service factory (services/)
export const createPayeeService = (deps: PayeeServiceDeps) => {
  return {
    validatePayee: async (input) => {
      const registeredName = await deps.dataSource.fetchRegisteredName(...);
      return validatePayeeName(input.accountName, registeredName); // Uses pure function
    }
  };
};
```

## 📁 Directory Structure

```
src/
├── core/                    # Pure business logic (100% functional)
│   ├── payee-validation.ts
│   └── payment-validation.ts
├── services/                # Service layer (functional factories)
│   ├── payee-service-functional.ts
│   └── payment-service-functional.ts
├── graphql/                 # GraphQL layer (functional resolvers)
│   ├── payee-resolvers.ts
│   └── payment-resolvers.ts
├── infra/                   # Infrastructure (OOP where needed)
│   ├── http-payee-data-source.ts    # OOP - HTTP client
│   ├── mock-payee-data-source.ts    # OOP - for testing
│   └── console-logger.ts             # Simple class
├── ports/                   # Interfaces
└── factories/               # Composition root
    └── service-factory.ts
```

## 🚀 Usage Examples

### Using Pure Functions Directly
```typescript
import { validatePayeeName, calculateNameSimilarity } from 'shared-graphql/core/payee-validation';

// No setup needed - just call the function
const result = validatePayeeName('John Doe', 'Jon Doe');
console.log(result.confidence); // 0.92
```

### Using Functional Services
```typescript
import { createPayeeService } from 'shared-graphql';

const service = createPayeeService({
  dataSource: mockDataSource,
  logger: consoleLogger
});

const result = await service.validatePayee(input);
```

### In BFFs
```typescript
import { createServices, makePayeeResolvers } from 'shared-graphql';

// Create all services with functional factories
const services = createServices();

// Get functional resolvers
const resolvers = makePayeeResolvers(services);
```

## 💡 Key Principles

1. **Pure functions first** - Start with pure functions in `core/`
2. **Functional factories** - Use factory pattern for services
3. **OOP for infrastructure** - Classes only for external integrations
4. **Compose, don't inherit** - Favor function composition over class hierarchies
5. **Explicit dependencies** - Pass deps as parameters, not via `this`

This approach gives you the best of both worlds: simple, testable business logic with pragmatic infrastructure code.
