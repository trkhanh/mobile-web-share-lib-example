/**
 * Web BFF - Custom Downstream Endpoint Configurations
 * 
 * Shows different endpoint customization strategies for web applications
 */

import {
  IPaymentGateway,
  IPayeeDataSource,
  AuthorizationResult,
  CaptureResult,
  RefundResult
} from '../../shared-graphql/src';

// ============================================
// Scenario 1: Environment-Based Configuration
// ============================================

interface EndpointConfig {
  payeeRegistryUrl: string;
  paymentGatewayUrl: string;
  fraudCheckUrl?: string;
  timeout: number;
}

const endpointConfigs: Record<string, EndpointConfig> = {
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

export const getEndpointConfig = (): EndpointConfig => {
  const env = process.env.NODE_ENV || 'development';
  return endpointConfigs[env] || endpointConfigs.development;
};

/**
 * Environment-aware payee data source
 */
export const createEnvAwarePayeeDataSource = (): IPayeeDataSource => {
  const config = getEndpointConfig();

  return {
    fetchRegisteredName: async (accountNumber: string, bankCode: string): Promise<string> => {
      const response = await fetch(`${config.payeeRegistryUrl}/api/payee-registry/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Environment': process.env.NODE_ENV || 'development'
        },
        body: JSON.stringify({ accountNumber, bankCode })
      });

      if (!response.ok) {
        throw new Error(`Payee Registry Error: ${response.status}`);
      }

      const data = await response.json();
      return data.registeredName;
    }
  };
};

// ============================================
// Scenario 2: Multi-Region with Fallback
// ============================================

/**
 * Try multiple regions for high availability
 * Primary: US-East, Fallback: US-West, Final: EU
 */
export const createMultiRegionPaymentGateway = (): IPaymentGateway => {
  const regions = [
    'https://payments.us-east-1.example.com',
    'https://payments.us-west-2.example.com',
    'https://payments.eu-central-1.example.com'
  ];

  const executeWithFallback = async <T>(
    operation: (baseUrl: string) => Promise<T>
  ): Promise<T> => {
    let lastError: Error | null = null;

    for (const region of regions) {
      try {
        console.log(`[Multi-Region] Attempting: ${region}`);
        const result = await operation(region);
        console.log(`[Multi-Region] Success: ${region}`);
        return result;
      } catch (error: any) {
        console.warn(`[Multi-Region] Failed: ${region}`, error.message);
        lastError = error;
        continue;
      }
    }

    throw lastError || new Error('All regions failed');
  };

  return {
    authorize: async (amount, currency, from, to): Promise<AuthorizationResult> => {
      try {
        return await executeWithFallback(async (baseUrl) => {
          const response = await fetch(`${baseUrl}/api/payments/authorize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, currency, from, to })
          });

          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const result = await response.json();
          return {
            success: result.status === 'AUTHORIZED',
            providerRef: result.providerRef,
            error: result.error
          };
        });
      } catch (error: any) {
        return { success: false, error: 'ALL_REGIONS_FAILED' };
      }
    },

    capture: async (providerRef) => {
      return await executeWithFallback(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/payments/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerRef })
        });
        const result = await response.json();
        return { success: result.status === 'CAPTURED' };
      });
    },

    refund: async (providerRef, amount) => {
      return await executeWithFallback(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/payments/refund`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerRef, amount })
        });
        const result = await response.json();
        return { success: result.status === 'REFUNDED' };
      });
    }
  };
};

// ============================================
// Scenario 3: Custom Headers & Auth
// ============================================

/**
 * Add web-specific authentication and headers
 */
export const createAuthenticatedPaymentGateway = (
  getUserToken: () => Promise<string>
): IPaymentGateway => {
  const config = getEndpointConfig();
  const baseUrl = config.paymentGatewayUrl;

  const authenticatedFetch = async (endpoint: string, body: any) => {
    const token = await getUserToken();
    
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Client-Type': 'web-bff',
        'X-Request-ID': crypto.randomUUID()
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Gateway Error: ${response.status}`);
    }

    return await response.json();
  };

  return {
    authorize: async (amount, currency, from, to): Promise<AuthorizationResult> => {
      try {
        const result = await authenticatedFetch('/api/payments/authorize', {
          amount,
          currency,
          from,
          to
        });
        return {
          success: result.status === 'AUTHORIZED',
          providerRef: result.providerRef,
          error: result.error
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    capture: async (providerRef) => {
      const result = await authenticatedFetch('/api/payments/capture', { providerRef });
      return { success: result.status === 'CAPTURED' };
    },

    refund: async (providerRef, amount) => {
      const result = await authenticatedFetch('/api/payments/refund', { providerRef, amount });
      return { success: result.status === 'REFUNDED' };
    }
  };
};

// ============================================
// Scenario 4: Fraud Check Integration
// ============================================

/**
 * Wrap payment gateway with fraud checking
 */
export const createFraudProtectedGateway = (baseGateway: IPaymentGateway): IPaymentGateway => {
  const config = getEndpointConfig();
  const fraudCheckUrl = config.fraudCheckUrl;

  const checkForFraud = async (amount: number, from: string, to: string): Promise<boolean> => {
    if (!fraudCheckUrl) return false; // Skip if no fraud service

    try {
      const response = await fetch(`${fraudCheckUrl}/api/fraud/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, from, to }),
        signal: AbortSignal.timeout(2000) // 2 second timeout
      });

      const result = await response.json();
      return result.isFraudulent;
    } catch (error) {
      console.warn('[Fraud Check] Failed, allowing transaction', error);
      return false; // Fail open
    }
  };

  return {
    authorize: async (amount, currency, from, to): Promise<AuthorizationResult> => {
      // Check fraud before authorizing
      const isFraudulent = await checkForFraud(amount, from, to);
      
      if (isFraudulent) {
        console.warn('[Fraud Check] Transaction blocked', { amount, from, to });
        return { success: false, error: 'FRAUD_DETECTED' };
      }

      return await baseGateway.authorize(amount, currency, from, to);
    },

    capture: baseGateway.capture,
    refund: baseGateway.refund
  };
};

// ============================================
// Usage in Server
// ============================================

/**
 * Example: Create services with custom endpoint strategies
 */
export const createWebServicesWithCustomEndpoints = (options?: {
  useMultiRegion?: boolean;
  getUserToken?: () => Promise<string>;
  enableFraudCheck?: boolean;
}) => {
  const { createServices } = require('../../shared-graphql/src');

  let paymentGateway: IPaymentGateway;

  if (options?.useMultiRegion) {
    paymentGateway = createMultiRegionPaymentGateway();
  } else if (options?.getUserToken) {
    paymentGateway = createAuthenticatedPaymentGateway(options.getUserToken);
  } else {
    // Default: use environment-based
    const { createHttpPaymentGateway } = require('../../shared-graphql/src');
    paymentGateway = createHttpPaymentGateway(getEndpointConfig().paymentGatewayUrl);
  }

  // Optionally wrap with fraud protection
  if (options?.enableFraudCheck) {
    paymentGateway = createFraudProtectedGateway(paymentGateway);
  }

  return createServices({
    payeeDataSource: createEnvAwarePayeeDataSource(),
    paymentGateway
  });
};
