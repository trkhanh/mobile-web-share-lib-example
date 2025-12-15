
# Concrete Example: Payee Validation for Mobile & Web BFFs

Let me show you **real, practical code** for your scenario without assumptions about mobile/web features.

## **🏗️ Project Structure**

```
shared-graphql/
├── src/
│   ├── types/
│   │   └── payee.ts
│   ├── schema/
│   │   └── payee.graphql
│   ├── resolvers/
│   │   └── payee-resolvers.ts
│   ├── services/
│   │   └── payee-service.ts
│   └── index.ts
```

## **📦 Shared Library (`shared-graphql` package)**

### **1. Types (Layer 1 - Contracts)**
```typescript
// shared-graphql/src/types/payee.ts
export interface Payee {
  id: string;
  name: string;
  accountNumber: string;
  bankCode: string;
  accountType: 'CHECKING' | 'SAVINGS';
}

export interface ValidatePayeeInput {
  accountNumber: string;
  accountName: string;
  bankCode: string;
}

export interface ValidatePayeeResult {
  isValid: boolean;
  matchLevel: 'EXACT' | 'CLOSE' | 'NO_MATCH';
  confidence: number;
  suggestedName?: string;
}

export interface PayeeServiceDependencies {
  dataSource: {
    fetchRegisteredName: (accountNumber: string, bankCode: string) => Promise<string>;
  };
  logger?: {
    info: (message: string, meta?: any) => void;
    error: (message: string, error: any) => void;
  };
}
```

### **2. GraphQL Schema (Layer 1 - Contracts)**
```typescript
// shared-graphql/src/schema/payee.graphql
export const payeeTypeDefs = gql`
  type Payee {
    id: ID!
    name: String!
    accountNumber: String!
    bankCode: String!
    accountType: AccountType!
  }

  enum AccountType {
    CHECKING
    SAVINGS
  }

  type ValidatePayeeResult {
    isValid: Boolean!
    matchLevel: MatchLevel!
    confidence: Float!
    suggestedName: String
  }

  enum MatchLevel {
    EXACT
    CLOSE
    NO_MATCH
  }

  input ValidatePayeeInput {
    accountNumber: String!
    accountName: String!
    bankCode: String!
  }

  extend type Query {
    validatePayee(input: ValidatePayeeInput!): ValidatePayeeResult!
    getPayee(id: ID!): Payee
  }

  extend type Mutation {
    createPayee(input: CreatePayeeInput!): Payee!
  }
`;
```

### **3. Pure Business Logic (Layer 2 - Core)**
```typescript
// shared-graphql/src/resolvers/payee-resolvers.ts
// PURE FUNCTIONS - No dependencies, no side effects

export const calculateNameSimilarity = (
  name1: string,
  name2: string
): number => {
  // Simple similarity calculation (Levenshtein ratio)
  const maxLength = Math.max(name1.length, name2.length);
  if (maxLength === 0) return 1.0;
  
  // Convert to lowercase for case-insensitive comparison
  const lower1 = name1.toLowerCase();
  const lower2 = name2.toLowerCase();
  
  // Simple character matching (you'd use a proper algorithm in production)
  let matches = 0;
  for (let i = 0; i < Math.min(lower1.length, lower2.length); i++) {
    if (lower1[i] === lower2[i]) matches++;
  }
  
  return matches / maxLength;
};

export const validatePayeeName = (
  inputName: string,
  registeredName: string
): ValidatePayeeResult => {
  const similarity = calculateNameSimilarity(inputName, registeredName);
  
  return {
    isValid: similarity >= 0.85,
    matchLevel: similarity >= 0.95 ? 'EXACT' : 
                similarity >= 0.85 ? 'CLOSE' : 'NO_MATCH',
    confidence: similarity,
    suggestedName: similarity < 0.85 ? registeredName : undefined
  };
};

export const validateAccountNumberFormat = (
  accountNumber: string,
  bankCode: string
): boolean => {
  // Basic format validation
  const isValidLength = accountNumber.length >= 8 && accountNumber.length <= 12;
  const isNumeric = /^\d+$/.test(accountNumber);
  
  // Different banks might have different formats
  if (bankCode.startsWith('01')) {
    return isValidLength && isNumeric && accountNumber.startsWith('1');
  }
  
  return isValidLength && isNumeric;
};
```

### **4. Service Factory (Layer 3 - Implementation)**
```typescript
// shared-graphql/src/services/payee-service.ts
// Configurable service - apps can use or implement their own

import { PayeeServiceDependencies, ValidatePayeeInput, ValidatePayeeResult } from '../types/payee';

export class PayeeService {
  constructor(private dependencies: PayeeServiceDependencies) {}

  async validatePayee(input: ValidatePayeeInput): Promise<ValidatePayeeResult> {
    try {
      // Step 1: Validate account number format
      const isAccountValid = validateAccountNumberFormat(
        input.accountNumber,
        input.bankCode
      );
      
      if (!isAccountValid) {
        return {
          isValid: false,
          matchLevel: 'NO_MATCH',
          confidence: 0,
          suggestedName: undefined
        };
      }

      // Step 2: Fetch registered name from data source
      const registeredName = await this.dependencies.dataSource.fetchRegisteredName(
        input.accountNumber,
        input.bankCode
      );

      // Step 3: Compare names using pure business logic
      const validationResult = validatePayeeName(input.accountName, registeredName);

      // Log result if logger is provided
      this.dependencies.logger?.info('Payee validation completed', {
        accountNumber: input.accountNumber,
        result: validationResult
      });

      return validationResult;

    } catch (error) {
      this.dependencies.logger?.error('Payee validation failed', error);
      throw error;
    }
  }

  // Other methods can be added here
  async getPayee(id: string): Promise<any> {
    // Implementation would go here
    return { id, name: 'John Doe' };
  }
}

// Factory function for convenience
export const createPayeeService = (
  dependencies: PayeeServiceDependencies
): PayeeService => {
  return new PayeeService(dependencies);
};
```

## **📱 Mobile BFF Implementation**

```typescript
// mobile-bff/src/server.ts
import { ApolloServer } from 'apollo-server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { 
  payeeTypeDefs, 
  createPayeeService,
  validatePayeeName,
  validateAccountNumberFormat 
} from '@company/shared-graphql';

// Mobile-specific types
const mobileTypeDefs = gql`
  extend type ValidatePayeeResult {
    mobileOptimizedPayload: String # Mobile-only field
  }
  
  type MobileDeviceInfo {
    deviceId: String!
    osVersion: String!
  }
  
  extend type Query {
    getDeviceInfo: MobileDeviceInfo!
  }
`;

// Mobile-specific context
interface MobileContext {
  deviceId?: string;
  appVersion?: string;
  networkType?: 'wifi' | 'cellular' | 'unknown';
}

// Mobile-specific data source
const mobileDataSource = {
  fetchRegisteredName: async (accountNumber: string, bankCode: string): Promise<string> => {
    // Mobile might call a different API endpoint
    const response = await fetch(`${process.env.MOBILE_API_URL}/payees/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-ID': 'mobile-device-123', // Mobile-specific header
        'Authorization': `Bearer ${process.env.MOBILE_API_KEY}`
      },
      body: JSON.stringify({ accountNumber, bankCode })
    });
    
    const data = await response.json();
    return data.registeredName;
  }
};

// Create mobile-specific service
const payeeService = createPayeeService({
  dataSource: mobileDataSource,
  logger: {
    info: (message, meta) => console.log(`[MOBILE] ${message}`, meta),
    error: (message, error) => console.error(`[MOBILE] ${message}`, error)
  }
});

// Mobile-specific resolvers
const mobileResolvers = {
  Query: {
    validatePayee: async (_: any, { input }: any, context: MobileContext) => {
      // Mobile-specific: Add device info to validation
      const result = await payeeService.validatePayee(input);
      
      // Mobile-only field: Add optimized payload for mobile
      return {
        ...result,
        mobileOptimizedPayload: JSON.stringify({
          ...result,
          deviceId: context.deviceId
        })
      };
    },
    
    getDeviceInfo: () => ({
      deviceId: 'mobile-device-123',
      osVersion: 'iOS 16.4'
    }),
    
    getPayee: async (_: any, { id }: any) => {
      return payeeService.getPayee(id);
    }
  }
};

// Create mobile Apollo Server
const mobileSchema = makeExecutableSchema({
  typeDefs: [payeeTypeDefs, mobileTypeDefs],
  resolvers: mobileResolvers
});

const mobileServer = new ApolloServer({
  schema: mobileSchema,
  context: ({ req }): MobileContext => {
    // Mobile-specific context extraction
    return {
      deviceId: req.headers['x-device-id'] as string,
      appVersion: req.headers['x-app-version'] as string,
      networkType: req.headers['x-network-type'] as 'wifi' | 'cellular' | 'unknown'
    };
  },
  
  // Mobile-specific Apollo configuration
  cache: 'bounded', // Mobile might want bounded cache
  persistedQueries: {
    // Mobile might use persisted queries for performance
    cache: new InMemoryLRUCache()
  }
});

// Start mobile BFF on port 4001
mobileServer.listen({ port: 4001 }).then(({ url }) => {
  console.log(`🚀 Mobile BFF ready at ${url}`);
});
```

## **🌐 Web BFF Implementation**

```typescript
// web-bff/src/server.ts
import { ApolloServer } from 'apollo-server-express';
import express from 'express';
import session from 'express-session';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { 
  payeeTypeDefs, 
  createPayeeService,
  validatePayeeName,
  validateAccountNumberFormat 
} from '@company/shared-graphql';

// Web-specific types
const webTypeDefs = gql`
  extend type ValidatePayeeResult {
    validationId: ID! # Web-only field for tracking
  }
  
  type SessionInfo {
    sessionId: String!
    expiresAt: String!
  }
  
  extend type Query {
    getSessionInfo: SessionInfo!
  }
`;

// Web-specific context
interface WebContext {
  session: any;
  cookies: Record<string, string>;
  ipAddress: string;
}

// Web-specific data source
const webDataSource = {
  fetchRegisteredName: async (accountNumber: string, bankCode: string): Promise<string> => {
    // Web might use GraphQL to fetch data
    // Or call a different REST endpoint
    const response = await fetch(`${process.env.WEB_API_URL}/v2/payees/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'web-csrf-token', // Web-specific header
        'Cookie': `session=${process.env.SESSION_ID}`
      },
      body: JSON.stringify({ accountNumber, bankCode })
    });
    
    const data = await response.json();
    return data.name;
  }
};

// Create web-specific service
const payeeService = createPayeeService({
  dataSource: webDataSource,
  logger: {
    info: (message, meta) => console.log(`[WEB] ${message}`, meta),
    error: (message, error) => console.error(`[WEB] ${message}`, error)
  }
});

// Web-specific resolvers
const webResolvers = {
  Query: {
    validatePayee: async (_: any, { input }: any, context: WebContext) => {
      // Web-specific: Check session cache first
      const cacheKey = `validate_${input.accountNumber}`;
      const cached = context.session[cacheKey];
      
      if (cached) {
        return cached;
      }
      
      // Use shared service
      const result = await payeeService.validatePayee(input);
      
      // Web-only field: Add validation ID for tracking
      const validationId = `val_${Date.now()}`;
      const webResult = {
        ...result,
        validationId
      };
      
      // Web-specific: Cache in session
      context.session[cacheKey] = webResult;
      
      return webResult;
    },
    
    getSessionInfo: (_: any, __: any, context: WebContext) => {
      return {
        sessionId: context.session.id,
        expiresAt: new Date(context.session.cookie.expires).toISOString()
      };
    },
    
    getPayee: async (_: any, { id }: any, context: WebContext) => {
      // Web might have different authorization checks
      if (!context.session.userId) {
        throw new Error('Unauthorized');
      }
      return payeeService.getPayee(id);
    }
  }
};

// Create Express app with web-specific middleware
const app = express();
app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false
}));

const webSchema = makeExecutableSchema({
  typeDefs: [payeeTypeDefs, webTypeDefs],
  resolvers: webResolvers
});

const webServer = new ApolloServer({
  schema: webSchema,
  context: ({ req, res }): WebContext => {
    // Web-specific context extraction
    return {
      session: req.session,
      cookies: req.cookies,
      ipAddress: req.ip
    };
  },
  
  // Web-specific Apollo configuration
  cache: new KeyvAdapter(new Keyv(process.env.REDIS_URL)), // Web uses Redis
  introspection: true, // Web might want introspection
  playground: true // Web needs GraphQL playground
});

webServer.start().then(() => {
  webServer.applyMiddleware({ 
    app,
    path: '/graphql',
    cors: {
      origin: process.env.WEB_APP_ORIGIN,
      credentials: true // Web needs CORS with credentials
    }
  });
  
  app.listen(4002, () => {
    console.log(`🚀 Web BFF ready at http://localhost:4002/graphql`);
  });
});
```

## **📦 Package.json for Shared Library**

```json
{
  "name": "@company/shared-graphql",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./types": "./dist/types/index.js",
    "./schema": "./dist/schema/index.js",
    "./resolvers": "./dist/resolvers/index.js",
    "./services": "./dist/services/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "test:coverage": "jest --coverage"
  },
  "dependencies": {
    "graphql": "^16.0.0"
  },
  "devDependencies": {
    "@graphql-tools/schema": "^9.0.0",
    "@types/node": "^18.0.0",
    "typescript": "^5.0.0"
  },
  "peerDependencies": {
    "graphql": ">=15.0.0"
  }
}
```

## **✅ Key Takeaways:**

1. **Shared Library Provides:**
   - Types/Interfaces (contracts)
   - Pure business logic functions
   - Service factory (optional to use)

2. **Each BFF Customizes:**
   - Data source implementations
   - Authentication/authorization
   - Caching strategies
   - Error handling
   - Additional fields/types

3. **Real Differences in Code:**
   - Mobile: Might add `deviceId`, use different API endpoints
   - Web: Might use sessions, cookies, different caching

4. **Shared Logic Stays Consistent:**
   - `validatePayeeName()` - same algorithm everywhere
   - `validateAccountNumberFormat()` - same rules everywhere

**This approach gives you:** 
- ✅ **Consistency** where it matters (business rules)
- ✅ **Flexibility** where you need it (platform specifics)
- ✅ **Maintainability** (changes to business logic in one place)
- ✅ **Testability** (pure functions are easy to test)