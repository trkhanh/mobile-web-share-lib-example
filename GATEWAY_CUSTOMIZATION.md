# Gateway Customization Guide

This guide shows how to customize HTTP headers, response transformation, and error handling when calling downstream services.

## 🎯 Three Customization Points

```
Request Flow:
   ┌─────────────────────────────────────────────────────┐
   │  1. Custom Headers (Before Downstream Call)        │
   │     ✅ Add authentication                           │
   │     ✅ Add tracking/correlation IDs                 │
   │     ✅ Add mobile-specific headers                  │
   │     ✅ Override default headers                     │
   └─────────────────────────────────────────────────────┘
                          ↓
   ┌─────────────────────────────────────────────────────┐
   │          Downstream Service Call                    │
   └─────────────────────────────────────────────────────┘
                          ↓
   ┌─────────────────────────────────────────────────────┐
   │  2. Response Transformation (After Downstream Call) │
   │     ✅ Transform data format                        │
   │     ✅ Add computed fields                          │
   │     ✅ Filter sensitive data                        │
   │     ✅ Enrich with additional data                  │
   └─────────────────────────────────────────────────────┘
                          ↓
   ┌─────────────────────────────────────────────────────┐
   │  3. Error Handling & Code Mapping                   │
   │     ✅ Map downstream errors to BFF codes           │
   │     ✅ Mobile-specific error messages               │
   │     ✅ Web-specific error details                   │
   │     ✅ Add retry logic                              │
   └─────────────────────────────────────────────────────┘
```

---

## 1️⃣ Custom Headers (Request Interception)

### Scenario A: Add Authentication Headers

**Use Case:** Web BFF adds JWT token to all downstream requests

```typescript
import { IPaymentGateway } from '../../shared-graphql/src/ports/gateway';
import { createHttpPaymentGateway } from '../../shared-graphql/src/infra/http-gateway-functional';

export function createAuthenticatedGateway(
  getUserToken: () => Promise<string>
): IPaymentGateway {
  const baseGateway = createHttpPaymentGateway({
    baseUrl: process.env.PAYMENT_API_URL || 'https://api.example.com'
  });

  return {
    authorize: async (payment) => {
      // Get fresh token
      const token = await getUserToken();
      
      // Add authorization header
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Call with custom headers
      return await baseGateway.authorize({
        ...payment,
        metadata: {
          ...payment.metadata,
          headers
        }
      });
    },

    capture: async (paymentId, amount) => {
      const token = await getUserToken();
      return await baseGateway.capture(paymentId, amount, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    },

    refund: async (paymentId, amount, reason) => {
      const token = await getUserToken();
      return await baseGateway.refund(paymentId, amount, reason, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
  };
}
```

### Scenario B: Mobile-Specific Headers

**Use Case:** Mobile BFF adds device info, app version, and platform headers

```typescript
export function createMobileHeaderGateway(context: {
  deviceId: string;
  platform: 'iOS' | 'Android';
  appVersion: string;
  userId?: string;
}): IPaymentGateway {
  const baseGateway = createHttpPaymentGateway({
    baseUrl: process.env.MOBILE_API_URL || 'https://mobile-api.example.com'
  });

  // Standard mobile headers for all requests
  const mobileHeaders = {
    'X-Device-Id': context.deviceId,
    'X-Platform': context.platform,
    'X-App-Version': context.appVersion,
    'X-User-Id': context.userId || 'anonymous',
    'X-Request-Id': generateRequestId(),
    'User-Agent': `MobileApp/${context.appVersion} (${context.platform})`
  };

  return {
    authorize: async (payment) => {
      return await baseGateway.authorize({
        ...payment,
        metadata: {
          ...payment.metadata,
          headers: {
            ...mobileHeaders,
            'X-Transaction-Type': 'MOBILE_PAYMENT'
          }
        }
      });
    },

    capture: async (paymentId, amount) => {
      return await baseGateway.capture(paymentId, amount, {
        headers: mobileHeaders
      });
    },

    refund: async (paymentId, amount, reason) => {
      return await baseGateway.refund(paymentId, amount, reason, {
        headers: {
          ...mobileHeaders,
          'X-Refund-Reason': reason
        }
      });
    }
  };
}

function generateRequestId(): string {
  return `mobile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
```

### Scenario C: Correlation ID & Tracing

**Use Case:** Add distributed tracing headers for observability

```typescript
export function createTracedGateway(
  baseGateway: IPaymentGateway,
  getTraceContext: () => { traceId: string; spanId: string }
): IPaymentGateway {
  return {
    authorize: async (payment) => {
      const { traceId, spanId } = getTraceContext();
      
      return await baseGateway.authorize({
        ...payment,
        metadata: {
          ...payment.metadata,
          headers: {
            'X-Trace-Id': traceId,
            'X-Span-Id': spanId,
            'X-Parent-Span-Id': spanId,
            'X-Correlation-Id': traceId,
            'X-Request-Timestamp': new Date().toISOString()
          }
        }
      });
    },

    capture: async (paymentId, amount) => {
      const { traceId, spanId } = getTraceContext();
      return await baseGateway.capture(paymentId, amount, {
        headers: {
          'X-Trace-Id': traceId,
          'X-Span-Id': `${spanId}-capture`
        }
      });
    },

    refund: async (paymentId, amount, reason) => {
      const { traceId, spanId } = getTraceContext();
      return await baseGateway.refund(paymentId, amount, reason, {
        headers: {
          'X-Trace-Id': traceId,
          'X-Span-Id': `${spanId}-refund`
        }
      });
    }
  };
}
```

---

## 2️⃣ Response Transformation (Response Interception)

### Scenario A: Mobile Response Simplification

**Use Case:** Mobile needs simpler, smaller responses to save bandwidth

```typescript
export function createMobileOptimizedGateway(
  baseGateway: IPaymentGateway
): IPaymentGateway {
  return {
    authorize: async (payment) => {
      // Call downstream
      const response = await baseGateway.authorize(payment);

      // Transform for mobile - only essential fields
      return {
        success: response.success,
        paymentId: response.paymentId,
        // Remove verbose fields, add mobile-optimized data
        status: response.success ? 'OK' : 'FAIL',
        // Cache hint for mobile
        cacheable: response.success,
        cacheUntil: response.success 
          ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
          : undefined
      };
    },

    capture: async (paymentId, amount) => {
      const response = await baseGateway.capture(paymentId, amount);
      
      // Simplified response
      return {
        success: response.success,
        amount: response.amount,
        status: response.status,
        timestamp: new Date().toISOString()
      };
    },

    refund: async (paymentId, amount, reason) => {
      const response = await baseGateway.refund(paymentId, amount, reason);
      
      return {
        success: response.success,
        refundId: response.refundId,
        status: response.success ? 'REFUNDED' : 'FAILED'
      };
    }
  };
}
```

### Scenario B: Web Response Enrichment

**Use Case:** Web needs rich metadata and audit information

```typescript
export function createWebEnrichedGateway(
  baseGateway: IPaymentGateway,
  getAuditInfo: () => { userId: string; sessionId: string; ipAddress: string }
): IPaymentGateway {
  return {
    authorize: async (payment) => {
      const startTime = Date.now();
      const auditInfo = getAuditInfo();

      try {
        const response = await baseGateway.authorize(payment);

        // Enrich with web-specific metadata
        return {
          ...response,
          metadata: {
            requestedBy: auditInfo.userId,
            sessionId: auditInfo.sessionId,
            ipAddress: auditInfo.ipAddress,
            processingTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            apiVersion: '2.0'
          },
          auditLog: {
            action: 'PAYMENT_AUTHORIZED',
            userId: auditInfo.userId,
            amount: payment.amount,
            currency: payment.currency,
            timestamp: new Date().toISOString()
          }
        };
      } catch (error) {
        // Even errors get audit info
        throw {
          ...error,
          auditInfo,
          processingTime: Date.now() - startTime
        };
      }
    },

    capture: async (paymentId, amount) => {
      const response = await baseGateway.capture(paymentId, amount);
      const auditInfo = getAuditInfo();

      return {
        ...response,
        capturedBy: auditInfo.userId,
        capturedAt: new Date().toISOString(),
        sessionId: auditInfo.sessionId
      };
    },

    refund: async (paymentId, amount, reason) => {
      const response = await baseGateway.refund(paymentId, amount, reason);
      const auditInfo = getAuditInfo();

      return {
        ...response,
        refundedBy: auditInfo.userId,
        refundedAt: new Date().toISOString(),
        refundReason: reason,
        requiresApproval: amount > 1000 // Business rule
      };
    }
  };
}
```

### Scenario C: Data Filtering & Privacy

**Use Case:** Remove sensitive data based on user role

```typescript
export function createPrivacyFilteredGateway(
  baseGateway: IPaymentGateway,
  getUserRole: () => 'admin' | 'user' | 'viewer'
): IPaymentGateway {
  function filterSensitiveData(data: any, role: string) {
    if (role === 'admin') {
      return data; // Admins see everything
    }

    // Remove sensitive fields for non-admins
    const filtered = { ...data };
    delete filtered.accountNumber;
    delete filtered.cvv;
    delete filtered.fullCardNumber;
    
    if (role === 'viewer') {
      delete filtered.amount; // Viewers don't see amounts
    }

    return filtered;
  }

  return {
    authorize: async (payment) => {
      const response = await baseGateway.authorize(payment);
      const role = getUserRole();

      return filterSensitiveData(response, role);
    },

    capture: async (paymentId, amount) => {
      const response = await baseGateway.capture(paymentId, amount);
      const role = getUserRole();

      return filterSensitiveData(response, role);
    },

    refund: async (paymentId, amount, reason) => {
      const response = await baseGateway.refund(paymentId, amount, reason);
      const role = getUserRole();

      return filterSensitiveData(response, role);
    }
  };
}
```

---

## 3️⃣ Error Handling & Code Mapping

### Scenario A: Mobile-Specific Error Codes

**Use Case:** Mobile needs simple, actionable error codes with offline support

```typescript
// Mobile error code mapping
type MobileErrorCode = 
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INSUFFICIENT_FUNDS'
  | 'INVALID_ACCOUNT'
  | 'BIOMETRIC_REQUIRED'
  | 'APP_UPDATE_REQUIRED'
  | 'SERVICE_UNAVAILABLE'
  | 'UNKNOWN_ERROR';

interface MobileError {
  code: MobileErrorCode;
  message: string;
  retryable: boolean;
  offlineCapable: boolean;
  userAction?: string;
}

export function createMobileErrorHandlingGateway(
  baseGateway: IPaymentGateway
): IPaymentGateway {
  function mapToMobileError(error: any): MobileError {
    // Network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return {
        code: 'NETWORK_ERROR',
        message: 'Cannot connect to server. Check your internet connection.',
        retryable: true,
        offlineCapable: true,
        userAction: 'Tap to retry when online'
      };
    }

    // Timeout
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      return {
        code: 'TIMEOUT',
        message: 'Request timed out. Please try again.',
        retryable: true,
        offlineCapable: false,
        userAction: 'Retry'
      };
    }

    // Business errors from downstream
    if (error.downstreamCode === 'INSUFFICIENT_BALANCE') {
      return {
        code: 'INSUFFICIENT_FUNDS',
        message: 'You don\'t have enough funds for this payment.',
        retryable: false,
        offlineCapable: false,
        userAction: 'Add funds to your account'
      };
    }

    if (error.downstreamCode === 'INVALID_PAYEE') {
      return {
        code: 'INVALID_ACCOUNT',
        message: 'The recipient account is invalid.',
        retryable: false,
        offlineCapable: false,
        userAction: 'Check the account number'
      };
    }

    // Service unavailable
    if (error.status === 503 || error.status === 502) {
      return {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service is temporarily unavailable.',
        retryable: true,
        offlineCapable: false,
        userAction: 'Try again in a few minutes'
      };
    }

    // Unknown
    return {
      code: 'UNKNOWN_ERROR',
      message: 'Something went wrong. Please try again.',
      retryable: true,
      offlineCapable: false,
      userAction: 'Contact support if this persists'
    };
  }

  return {
    authorize: async (payment) => {
      try {
        return await baseGateway.authorize(payment);
      } catch (error) {
        throw mapToMobileError(error);
      }
    },

    capture: async (paymentId, amount) => {
      try {
        return await baseGateway.capture(paymentId, amount);
      } catch (error) {
        throw mapToMobileError(error);
      }
    },

    refund: async (paymentId, amount, reason) => {
      try {
        return await baseGateway.refund(paymentId, amount, reason);
      } catch (error) {
        throw mapToMobileError(error);
      }
    }
  };
}
```

### Scenario B: Web-Specific Error Details

**Use Case:** Web needs detailed errors with debugging info for support teams

```typescript
interface WebError {
  code: string;
  message: string;
  details: string;
  technicalInfo: {
    originalError: string;
    statusCode?: number;
    downstreamService: string;
    timestamp: string;
    requestId?: string;
  };
  userMessage: string;
  supportMessage: string;
  recoverySteps: string[];
}

export function createWebErrorHandlingGateway(
  baseGateway: IPaymentGateway,
  getRequestId: () => string
): IPaymentGateway {
  function mapToWebError(error: any, operation: string): WebError {
    const requestId = getRequestId();

    // Network/connection errors
    if (error.code === 'ECONNREFUSED') {
      return {
        code: 'DOWNSTREAM_UNAVAILABLE',
        message: 'Payment service is unavailable',
        details: `Cannot connect to payment service at ${error.address}:${error.port}`,
        technicalInfo: {
          originalError: error.message,
          downstreamService: 'Payment Gateway',
          timestamp: new Date().toISOString(),
          requestId
        },
        userMessage: 'We\'re having trouble processing payments right now.',
        supportMessage: 'The payment gateway is unreachable. Check service status and network connectivity.',
        recoverySteps: [
          'Wait a few minutes and try again',
          'Contact support with Request ID: ' + requestId,
          'Check system status page'
        ]
      };
    }

    // Timeout
    if (error.code === 'ETIMEDOUT') {
      return {
        code: 'GATEWAY_TIMEOUT',
        message: 'Payment request timed out',
        details: `Request exceeded ${error.timeout}ms timeout`,
        technicalInfo: {
          originalError: error.message,
          downstreamService: 'Payment Gateway',
          timestamp: new Date().toISOString(),
          requestId
        },
        userMessage: 'The payment is taking longer than expected.',
        supportMessage: 'Gateway timeout. Payment state uncertain - check transaction status before retrying.',
        recoverySteps: [
          'Check if payment was processed',
          'If not processed, retry the payment',
          'Contact support if payment status is unclear'
        ]
      };
    }

    // Business validation errors
    if (error.downstreamCode === 'INSUFFICIENT_BALANCE') {
      return {
        code: 'INSUFFICIENT_FUNDS',
        message: 'Insufficient funds',
        details: `Account balance insufficient for payment of ${error.amount} ${error.currency}`,
        technicalInfo: {
          originalError: error.message,
          statusCode: error.status,
          downstreamService: 'Payment Gateway',
          timestamp: new Date().toISOString(),
          requestId
        },
        userMessage: 'Your account doesn\'t have enough funds for this payment.',
        supportMessage: 'Customer has insufficient balance. Available: ' + error.availableBalance,
        recoverySteps: [
          'Add funds to the account',
          'Use a different payment method',
          'Reduce the payment amount'
        ]
      };
    }

    // Fraud/security errors
    if (error.downstreamCode === 'FRAUD_DETECTED') {
      return {
        code: 'SECURITY_BLOCK',
        message: 'Payment blocked by security',
        details: 'Transaction flagged by fraud detection system',
        technicalInfo: {
          originalError: error.message,
          statusCode: error.status,
          downstreamService: 'Fraud Detection',
          timestamp: new Date().toISOString(),
          requestId
        },
        userMessage: 'This payment has been blocked for security reasons.',
        supportMessage: 'Fraud detection triggered. Review: ' + error.fraudReason,
        recoverySteps: [
          'Verify your identity',
          'Contact support to review the transaction',
          'Use an alternative payment method'
        ]
      };
    }

    // Generic downstream error
    return {
      code: 'PAYMENT_FAILED',
      message: 'Payment processing failed',
      details: error.message || 'Unknown error from payment service',
      technicalInfo: {
        originalError: JSON.stringify(error),
        statusCode: error.status,
        downstreamService: 'Payment Gateway',
        timestamp: new Date().toISOString(),
        requestId
      },
      userMessage: 'We couldn\'t process your payment.',
      supportMessage: 'Payment failed. Review logs for Request ID: ' + requestId,
      recoverySteps: [
        'Try again',
        'Check payment details are correct',
        'Contact support if issue persists'
      ]
    };
  }

  return {
    authorize: async (payment) => {
      try {
        return await baseGateway.authorize(payment);
      } catch (error) {
        throw mapToWebError(error, 'authorize');
      }
    },

    capture: async (paymentId, amount) => {
      try {
        return await baseGateway.capture(paymentId, amount);
      } catch (error) {
        throw mapToWebError(error, 'capture');
      }
    },

    refund: async (paymentId, amount, reason) => {
      try {
        return await baseGateway.refund(paymentId, amount, reason);
      } catch (error) {
        throw mapToWebError(error, 'refund');
      }
    }
  };
}
```

### Scenario C: Retry Logic with Exponential Backoff

**Use Case:** Automatically retry transient errors

```typescript
export function createRetryableGateway(
  baseGateway: IPaymentGateway,
  config: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    retryableErrors?: string[];
  } = {}
): IPaymentGateway {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    retryableErrors = ['ETIMEDOUT', 'ECONNREFUSED', '503', '502', '504']
  } = config;

  async function retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Check if error is retryable
        const isRetryable = retryableErrors.some(code => 
          error.code === code || 
          error.status?.toString() === code ||
          error.message?.includes(code)
        );

        if (!isRetryable || attempt === maxRetries) {
          throw error;
        }

        // Calculate backoff delay
        const delay = Math.min(
          initialDelay * Math.pow(2, attempt),
          maxDelay
        );

        console.warn(
          `${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}). ` +
          `Retrying in ${delay}ms...`,
          error.message
        );

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  return {
    authorize: async (payment) => {
      return retryWithBackoff(
        () => baseGateway.authorize(payment),
        'authorize'
      );
    },

    capture: async (paymentId, amount) => {
      return retryWithBackoff(
        () => baseGateway.capture(paymentId, amount),
        'capture'
      );
    },

    refund: async (paymentId, amount, reason) => {
      return retryWithBackoff(
        () => baseGateway.refund(paymentId, amount, reason),
        'refund'
      );
    }
  };
}
```

---

## 🎨 Combining Multiple Customizations

You can **compose** multiple wrappers together:

```typescript
// Example: Mobile BFF with everything
const mobileGateway = createRetryableGateway(
  createMobileErrorHandlingGateway(
    createMobileOptimizedGateway(
      createMobileHeaderGateway({
        deviceId: 'device-123',
        platform: 'iOS',
        appVersion: '2.1.0',
        userId: 'user-456'
      })
    )
  ),
  { maxRetries: 2, initialDelay: 500 } // Mobile needs faster retries
);

// Example: Web BFF with everything
const webGateway = createRetryableGateway(
  createWebErrorHandlingGateway(
    createWebEnrichedGateway(
      createAuthenticatedGateway(getUserToken),
      getAuditInfo
    ),
    getRequestId
  ),
  { maxRetries: 3, initialDelay: 1000 } // Web can wait longer
);

// Use in services
const services = createServices({
  gateway: mobileGateway // or webGateway
});
```

---

## 📊 Comparison Matrix

| Feature | Mobile BFF | Web BFF |
|---------|------------|---------|
| **Headers** | Device info, app version, platform | JWT auth, session ID, correlation ID |
| **Response** | Simplified (bandwidth-optimized) | Enriched (full metadata, audit logs) |
| **Errors** | Simple codes, retry hints, offline support | Detailed errors, debugging info, support steps |
| **Retry** | Fast (500ms-2s), max 2 retries | Slower (1s-10s), max 3 retries |
| **Timeout** | Short (5s for mobile networks) | Longer (30s for reliability) |

---

## ✅ Key Design Advantages

1. **Functional Composition**: Wrap gateways like functions (no inheritance)
2. **Separation of Concerns**: Headers, response, errors all independent
3. **Testable**: Each wrapper can be unit tested in isolation
4. **Composable**: Mix and match wrappers as needed
5. **Type-Safe**: TypeScript ensures correct interface implementation
6. **No Breaking Changes**: Shared library doesn't need to change

---

## 🚀 Quick Start

### Mobile BFF:
```typescript
import { createMobileHeaderGateway, createMobileErrorHandlingGateway } from './custom-gateway';

const gateway = createMobileErrorHandlingGateway(
  createMobileHeaderGateway({
    deviceId: req.headers['x-device-id'],
    platform: req.headers['x-platform'],
    appVersion: req.headers['x-app-version']
  })
);
```

### Web BFF:
```typescript
import { createAuthenticatedGateway, createWebErrorHandlingGateway } from './custom-gateway';

const gateway = createWebErrorHandlingGateway(
  createAuthenticatedGateway(() => req.session.token),
  () => req.headers['x-request-id']
);
```

---

## 📚 See Also

- **[Architecture.md](./Architecture.md)** - Overall design
- **[GRAPHQL_CUSTOMIZATION.md](./GRAPHQL_CUSTOMIZATION.md)** - GraphQL layer customization
- **[ENDPOINT_CUSTOMIZATION.md](./ENDPOINT_CUSTOMIZATION.md)** - Endpoint configuration
