# BFF Extension Guide

This guide shows how different BFFs can extend and customize the shared library for their specific needs.

## 🎯 Extension Patterns

### 1. Custom Downstream Endpoints

**Scenario:** Different BFFs need to point to different downstream services (dev/staging/prod, regional endpoints, etc.)

#### Pattern: Custom Data Source with Different URLs

```typescript
// mobile-bff/src/custom-data-sources.ts
import { createHttpPayeeDataSource } from '@company/shared-graphql';

/**
 * Mobile BFF uses regional payee registry
 * Points to Asia-Pacific endpoint
 */
export const createMobilePayeeDataSource = () => {
  const regionalUrl = process.env.APAC_PAYEE_REGISTRY_URL || 'https://payee-registry.apac.example.com';
  return createHttpPayeeDataSource(regionalUrl);
};

/**
 * Mobile BFF uses mobile-optimized payment gateway
 * Has different timeout/retry configuration
 */
export const createMobilePaymentGateway = () => {
  // Custom implementation with mobile-specific settings
  return {
    authorize: async (amount, currency, from, to) => {
      const response = await fetch('https://mobile-payments.example.com/v2/authorize', {
        method: 'POST',
        body: JSON.stringify({ amount, currency, from, to }),
        headers: { 
          'Content-Type': 'application/json',
          'X-Client-Type': 'mobile-app',
          'X-API-Version': 'v2'
        },
        timeout: 5000 // Shorter timeout for mobile
      });
      
      const result = await response.json();
      return {
        success: result.authorized,
        providerRef: result.transactionId,
        error: result.errorCode
      };
    },
    capture: async (providerRef) => {
      // Mobile-specific capture logic
      const response = await fetch('https://mobile-payments.example.com/v2/capture', {
        method: 'POST',
        body: JSON.stringify({ transactionId: providerRef }),
        headers: { 'X-Client-Type': 'mobile-app' }
      });
      const result = await response.json();
      return { success: result.captured };
    },
    refund: async (providerRef, amount) => {
      // Mobile-specific refund logic
      const response = await fetch('https://mobile-payments.example.com/v2/refund', {
        method: 'POST',
        body: JSON.stringify({ transactionId: providerRef, amount }),
        headers: { 'X-Client-Type': 'mobile-app' }
      });
      const result = await response.json();
      return { success: result.refunded };
    }
  };
};
```

```typescript
// mobile-bff/src/server.ts
import { createServices } from '@company/shared-graphql';
import { createMobilePayeeDataSource, createMobilePaymentGateway } from './custom-data-sources';

// Override shared library with mobile-specific endpoints
const services = createServices({
  payeeDataSource: createMobilePayeeDataSource(),
  paymentGateway: createMobilePaymentGateway()
});
```

---

### 2. Environment-Specific Configuration

**Scenario:** Web BFF uses different endpoints per environment (dev/staging/prod)

```typescript
// web-bff/src/config/endpoints.ts

export interface EndpointConfig {
  payeeRegistryUrl: string;
  paymentGatewayUrl: string;
  fraudCheckUrl: string;
  timeout: number;
}

const configs: Record<string, EndpointConfig> = {
  development: {
    payeeRegistryUrl: 'http://localhost:8081',
    paymentGatewayUrl: 'http://localhost:8080',
    fraudCheckUrl: 'http://localhost:8082',
    timeout: 10000
  },
  staging: {
    payeeRegistryUrl: 'https://payee-registry.staging.example.com',
    paymentGatewayUrl: 'https://payments.staging.example.com',
    fraudCheckUrl: 'https://fraud.staging.example.com',
    timeout: 5000
  },
  production: {
    payeeRegistryUrl: 'https://payee-registry.example.com',
    paymentGatewayUrl: 'https://payments.example.com',
    fraudCheckUrl: 'https://fraud.example.com',
    timeout: 3000
  }
};

export const getConfig = (): EndpointConfig => {
  const env = process.env.NODE_ENV || 'development';
  return configs[env] || configs.development;
};
```

```typescript
// web-bff/src/custom-infrastructure.ts
import { createHttpPayeeDataSource, createHttpPaymentGateway, IPaymentGateway } from '@company/shared-graphql';
import { getConfig } from './config/endpoints';

/**
 * Create data source with environment-specific URL
 */
export const createWebPayeeDataSource = () => {
  const config = getConfig();
  return createHttpPayeeDataSource(config.payeeRegistryUrl);
};

/**
 * Wrap payment gateway with custom headers and timeout
 */
export const createWebPaymentGateway = (): IPaymentGateway => {
  const config = getConfig();
  const baseGateway = createHttpPaymentGateway(config.paymentGatewayUrl);
  
  // Add web-specific headers and timeout handling
  return {
    authorize: async (amount, currency, from, to) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);
      
      try {
        const result = await baseGateway.authorize(amount, currency, from, to);
        clearTimeout(timeoutId);
        return result;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          return { success: false, error: 'REQUEST_TIMEOUT' };
        }
        throw error;
      }
    },
    capture: baseGateway.capture,
    refund: baseGateway.refund
  };
};
```

---

### 3. Protocol Translation

**Scenario:** BFF needs to translate between different API protocols (REST → gRPC, REST → GraphQL downstream, etc.)

```typescript
// mobile-bff/src/grpc-adapters.ts
import { IPayeeDataSource } from '@company/shared-graphql';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

/**
 * Adapter: Shared library expects REST, but mobile BFF uses gRPC backend
 */
export const createGrpcPayeeDataSource = (grpcEndpoint: string): IPayeeDataSource => {
  // Load proto file
  const packageDefinition = protoLoader.loadSync('./protos/payee-service.proto');
  const proto: any = grpc.loadPackageDefinition(packageDefinition);
  
  const client = new proto.payee.PayeeService(
    grpcEndpoint,
    grpc.credentials.createInsecure()
  );
  
  return {
    fetchRegisteredName: async (accountNumber: string, bankCode: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        client.GetRegisteredName(
          { accountNumber, bankCode },
          (error: any, response: any) => {
            if (error) {
              reject(new Error(`gRPC Error: ${error.message}`));
            } else {
              resolve(response.registeredName);
            }
          }
        );
      });
    }
  };
};
```

```typescript
// mobile-bff/src/server.ts
import { createServices } from '@company/shared-graphql';
import { createGrpcPayeeDataSource } from './grpc-adapters';

const services = createServices({
  payeeDataSource: createGrpcPayeeDataSource('localhost:50051')
});
```

---

### 4. Multiple Downstream Services with Fallback

**Scenario:** Web BFF wants to call multiple regional endpoints with fallback logic

```typescript
// web-bff/src/multi-region-gateway.ts
import { IPaymentGateway, AuthorizationResult } from '@company/shared-graphql';

/**
 * Multi-region payment gateway with automatic failover
 */
export const createMultiRegionGateway = (regions: string[]): IPaymentGateway => {
  const tryRegion = async (
    region: string,
    operation: () => Promise<any>
  ): Promise<any> => {
    try {
      console.log(`[Gateway] Attempting region: ${region}`);
      return await operation();
    } catch (error) {
      console.error(`[Gateway] Region ${region} failed:`, error.message);
      throw error;
    }
  };

  const executeWithFallback = async (
    operationFactory: (url: string) => Promise<any>
  ) => {
    let lastError: Error | null = null;
    
    for (const region of regions) {
      try {
        const result = await tryRegion(region, () => 
          operationFactory(`https://payments.${region}.example.com`)
        );
        return result;
      } catch (error) {
        lastError = error;
        continue;
      }
    }
    
    throw lastError || new Error('All regions failed');
  };

  return {
    authorize: async (amount, currency, from, to): Promise<AuthorizationResult> => {
      try {
        return await executeWithFallback(async (url) => {
          const response = await fetch(`${url}/api/payments/authorize`, {
            method: 'POST',
            body: JSON.stringify({ amount, currency, from, to }),
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          
          const result = await response.json();
          return {
            success: result.status === 'AUTHORIZED',
            providerRef: result.providerRef,
            error: result.error
          };
        });
      } catch (error) {
        return { success: false, error: 'ALL_REGIONS_FAILED' };
      }
    },
    
    capture: async (providerRef) => {
      return await executeWithFallback(async (url) => {
        const response = await fetch(`${url}/api/payments/capture`, {
          method: 'POST',
          body: JSON.stringify({ providerRef }),
          headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        return { success: result.status === 'CAPTURED' };
      });
    },
    
    refund: async (providerRef, amount) => {
      return await executeWithFallback(async (url) => {
        const response = await fetch(`${url}/api/payments/refund`, {
          method: 'POST',
          body: JSON.stringify({ providerRef, amount }),
          headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        return { success: result.status === 'REFUNDED' };
      });
    }
  };
};
```

```typescript
// web-bff/src/server.ts
import { createServices } from '@company/shared-graphql';
import { createMultiRegionGateway } from './multi-region-gateway';

// Try US-East first, fallback to US-West, then EU
const services = createServices({
  paymentGateway: createMultiRegionGateway(['us-east-1', 'us-west-2', 'eu-central-1'])
});
```

---

### 5. API Version Routing

**Scenario:** Mobile BFF needs to route to different API versions based on client version

```typescript
// mobile-bff/src/versioned-gateway.ts
import { IPaymentGateway, AuthorizationResult } from '@company/shared-graphql';

interface ClientContext {
  appVersion: string;
  platform: 'ios' | 'android';
}

/**
 * Routes to different API versions based on client version
 */
export const createVersionedGateway = (context: ClientContext): IPaymentGateway => {
  // Determine API version based on app version
  const getApiVersion = (): string => {
    const [major] = context.appVersion.split('.');
    const majorVersion = parseInt(major, 10);
    
    if (majorVersion >= 3) return 'v3';
    if (majorVersion >= 2) return 'v2';
    return 'v1';
  };

  const apiVersion = getApiVersion();
  const baseUrl = `https://payments.example.com/${apiVersion}`;
  
  console.log(`[Gateway] Using API ${apiVersion} for app version ${context.appVersion}`);

  return {
    authorize: async (amount, currency, from, to): Promise<AuthorizationResult> => {
      const endpoint = apiVersion === 'v1' 
        ? `${baseUrl}/authorize`  // v1 uses simple path
        : `${baseUrl}/payments/authorize`;  // v2+ uses nested path
      
      const response = await fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ amount, currency, from, to }),
        headers: {
          'Content-Type': 'application/json',
          'X-API-Version': apiVersion,
          'X-Client-Platform': context.platform,
          'X-Client-Version': context.appVersion
        }
      });
      
      const result = await response.json();
      
      // Handle different response formats per version
      if (apiVersion === 'v1') {
        return {
          success: result.authorized === true,
          providerRef: result.txId,
          error: result.errorMsg
        };
      } else {
        return {
          success: result.status === 'AUTHORIZED',
          providerRef: result.providerRef,
          error: result.error
        };
      }
    },
    
    capture: async (providerRef) => {
      const response = await fetch(`${baseUrl}/payments/capture`, {
        method: 'POST',
        body: JSON.stringify({ providerRef }),
        headers: { 'X-API-Version': apiVersion }
      });
      const result = await response.json();
      return { success: result.status === 'CAPTURED' };
    },
    
    refund: async (providerRef, amount) => {
      const response = await fetch(`${baseUrl}/payments/refund`, {
        method: 'POST',
        body: JSON.stringify({ providerRef, amount }),
        headers: { 'X-API-Version': apiVersion }
      });
      const result = await response.json();
      return { success: result.status === 'REFUNDED' };
    }
  };
};
```

```typescript
// mobile-bff/src/server.ts
import { createServices } from '@company/shared-graphql';
import { createVersionedGateway } from './versioned-gateway';

app.use('/graphql', (req, res, next) => {
  // Extract client context from headers
  const clientContext = {
    appVersion: req.headers['x-app-version'] || '1.0.0',
    platform: req.headers['x-platform'] as 'ios' | 'android' || 'ios'
  };
  
  // Create services with versioned gateway
  const services = createServices({
    paymentGateway: createVersionedGateway(clientContext)
  });
  
  // Attach to request for GraphQL context
  req.services = services;
  next();
});
```

---

## 📊 Comparison Table

| Scenario | Use Case | Implementation Pattern | Complexity |
|----------|----------|----------------------|------------|
| **Custom Endpoints** | Different URLs per BFF | Override with custom URL | ⭐ Simple |
| **Environment Config** | Dev/Staging/Prod | Config-driven factory | ⭐⭐ Moderate |
| **Protocol Translation** | REST → gRPC | Adapter pattern | ⭐⭐⭐ Complex |
| **Multi-Region Fallback** | High availability | Wrapper with retry logic | ⭐⭐⭐ Complex |
| **API Versioning** | Mobile app versions | Context-based routing | ⭐⭐ Moderate |

## 🎯 Best Practices

1. **Always use the factory pattern** - Don't instantiate classes directly
2. **Implement the port interfaces** - Ensures compatibility with shared services
3. **Add observability** - Log custom behavior for debugging
4. **Handle errors gracefully** - Convert downstream errors to shared error format
5. **Document extensions** - Keep a registry of custom implementations per BFF

## 🔧 Quick Start Template

```typescript
// your-bff/src/custom-adapters.ts
import { IPayeeDataSource, IPaymentGateway } from '@company/shared-graphql';

export const createCustomPayeeDataSource = (): IPayeeDataSource => ({
  fetchRegisteredName: async (accountNumber, bankCode) => {
    // Your custom logic here
    const response = await fetch('YOUR_ENDPOINT', { /* ... */ });
    return response.registeredName;
  }
});

export const createCustomPaymentGateway = (): IPaymentGateway => ({
  authorize: async (amount, currency, from, to) => {
    // Your custom logic here
  },
  capture: async (providerRef) => {
    // Your custom logic here
  },
  refund: async (providerRef, amount) => {
    // Your custom logic here
  }
});
```

```typescript
// your-bff/src/server.ts
import { createServices } from '@company/shared-graphql';
import { createCustomPayeeDataSource, createCustomPaymentGateway } from './custom-adapters';

const services = createServices({
  payeeDataSource: createCustomPayeeDataSource(),
  paymentGateway: createCustomPaymentGateway()
});
```
