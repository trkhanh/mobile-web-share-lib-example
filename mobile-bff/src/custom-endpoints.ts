/**
 * Mobile BFF - Custom Downstream Endpoint Configurations
 * 
 * Shows different ways to override downstream service endpoints
 */

import { 
  IPaymentGateway, 
  IPayeeDataSource,
  AuthorizationResult,
  CaptureResult,
  RefundResult
} from '../../shared-graphql/src';

// ============================================
// Scenario 1: Regional Endpoint Override
// ============================================

/**
 * Mobile app serves Asia-Pacific region
 * Uses regional payee registry endpoint
 */
export const createAPACPayeeDataSource = (): IPayeeDataSource => {
  const regionalUrl = process.env.APAC_PAYEE_REGISTRY_URL || 'https://payee-registry.apac.example.com';
  
  return {
    fetchRegisteredName: async (accountNumber: string, bankCode: string): Promise<string> => {
      const response = await fetch(`${regionalUrl}/api/v1/registry/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Region': 'APAC',
          'X-Client-Type': 'mobile-app'
        },
        body: JSON.stringify({ accountNumber, bankCode })
      });

      if (!response.ok) {
        throw new Error(`APAC Registry Error: ${response.status}`);
      }

      const data = await response.json();
      return data.registeredName;
    }
  };
};

// ============================================
// Scenario 2: Mobile-Optimized Gateway
// ============================================

/**
 * Mobile payment gateway with:
 * - Shorter timeouts for better UX
 * - Mobile-specific headers
 * - Retry logic for flaky mobile networks
 */
export const createMobilePaymentGateway = (): IPaymentGateway => {
  const mobileGatewayUrl = process.env.MOBILE_PAYMENT_GATEWAY_URL || 'https://mobile-payments.example.com';
  const timeout = 5000; // 5 seconds for mobile
  const maxRetries = 2;

  const fetchWithRetry = async (url: string, options: RequestInit, retries = 0): Promise<Response> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      if (error.name === 'AbortError' && retries < maxRetries) {
        console.log(`[Mobile Gateway] Retry ${retries + 1}/${maxRetries}`);
        return fetchWithRetry(url, options, retries + 1);
      }
      throw error;
    }
  };

  return {
    authorize: async (amount: number, currency: string, from: string, to: string): Promise<AuthorizationResult> => {
      try {
        const response = await fetchWithRetry(`${mobileGatewayUrl}/v2/authorize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Client-Type': 'mobile-app',
            'X-API-Version': 'v2',
            'X-Platform': process.env.MOBILE_PLATFORM || 'ios'
          },
          body: JSON.stringify({ amount, currency, from, to })
        });

        const result = await response.json();
        return {
          success: result.authorized,
          providerRef: result.transactionId,
          error: result.errorCode
        };
      } catch (error: any) {
        console.error('[Mobile Gateway] Authorization failed:', error.message);
        return {
          success: false,
          error: error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR'
        };
      }
    },

    capture: async (providerRef: string): Promise<CaptureResult> => {
      const response = await fetchWithRetry(`${mobileGatewayUrl}/v2/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client-Type': 'mobile-app' },
        body: JSON.stringify({ transactionId: providerRef })
      });
      const result = await response.json();
      return { success: result.captured };
    },

    refund: async (providerRef: string, amount: number): Promise<RefundResult> => {
      const response = await fetchWithRetry(`${mobileGatewayUrl}/v2/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client-Type': 'mobile-app' },
        body: JSON.stringify({ transactionId: providerRef, amount })
      });
      const result = await response.json();
      return { success: result.refunded };
    }
  };
};

// ============================================
// Scenario 3: Version-Based Routing
// ============================================

/**
 * Routes to different API versions based on app version
 * Older apps use v1, newer apps use v2 with better features
 */
export const createVersionedMobileGateway = (appVersion: string): IPaymentGateway => {
  const [major] = appVersion.split('.');
  const apiVersion = parseInt(major, 10) >= 3 ? 'v2' : 'v1';
  const baseUrl = `https://payments.example.com/${apiVersion}`;

  console.log(`[Mobile Gateway] Using API ${apiVersion} for app ${appVersion}`);

  return {
    authorize: async (amount, currency, from, to): Promise<AuthorizationResult> => {
      const endpoint = apiVersion === 'v1' 
        ? `${baseUrl}/authorize`
        : `${baseUrl}/payments/authorize`;

      const response = await fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ amount, currency, from, to }),
        headers: {
          'Content-Type': 'application/json',
          'X-API-Version': apiVersion,
          'X-App-Version': appVersion
        }
      });

      const result = await response.json();

      // v1 and v2 have different response formats
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
      return { success: result.status === 'CAPTURED' || result.captured };
    },

    refund: async (providerRef, amount) => {
      const response = await fetch(`${baseUrl}/payments/refund`, {
        method: 'POST',
        body: JSON.stringify({ providerRef, amount }),
        headers: { 'X-API-Version': apiVersion }
      });
      const result = await response.json();
      return { success: result.status === 'REFUNDED' || result.refunded };
    }
  };
};

// ============================================
// Usage in Server
// ============================================

/**
 * Example: Override endpoints when creating services
 */
export const createMobileServicesWithCustomEndpoints = (appVersion?: string) => {
  const { createServices } = require('../../shared-graphql/src');

  return createServices({
    // Use regional payee data source
    payeeDataSource: createAPACPayeeDataSource(),
    
    // Use version-aware payment gateway if version provided, otherwise mobile-optimized
    paymentGateway: appVersion 
      ? createVersionedMobileGateway(appVersion)
      : createMobilePaymentGateway()
  });
};
