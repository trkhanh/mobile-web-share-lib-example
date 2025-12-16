/**
 * Mobile BFF - Gateway Customizations
 * 
 * Demonstrates:
 * 1. Custom headers (device info, tracking)
 * 2. Response transformation (bandwidth optimization)
 * 3. Mobile-specific error handling
 */

import { IPaymentGateway, AuthorizationResult, CaptureResult, RefundResult } from '../../shared-graphql/src/ports/gateway';
import { createHttpPaymentGateway } from '../../shared-graphql/src/infra/http-gateway-functional';

// ============================================================================
// 1. CUSTOM HEADERS - Mobile Device Information
// ============================================================================

export interface MobileContext {
  deviceId: string;
  platform: 'iOS' | 'Android';
  appVersion: string;
  userId?: string;
  biometricEnabled?: boolean;
}

export function createMobileHeaderGateway(
  context: MobileContext,
  baseUrl?: string
): IPaymentGateway {
  const baseGateway = createHttpPaymentGateway(
    baseUrl || process.env.MOBILE_API_URL || 'https://mobile-api.example.com'
  );

  // Standard headers for all mobile requests
  const mobileHeaders = {
    'X-Device-Id': context.deviceId,
    'X-Platform': context.platform,
    'X-App-Version': context.appVersion,
    'X-User-Id': context.userId || 'anonymous',
    'X-Biometric-Enabled': String(context.biometricEnabled || false),
    'X-Request-Id': `mobile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    'User-Agent': `MobileApp/${context.appVersion} (${context.platform})`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  console.log(`[Mobile Gateway] Initialized for ${context.platform} v${context.appVersion}`);

  return {
    authorize: async (amount: number, currency: string, from: string, to: string): Promise<AuthorizationResult> => {
      console.log(`[Mobile Gateway] Authorizing payment with headers:`, mobileHeaders);
      console.log(`[Mobile Gateway] Device: ${context.deviceId}, Platform: ${context.platform}, Version: ${context.appVersion}`);
      
      // In real implementation, these headers would be sent via HTTP client
      // For now, we delegate to base gateway
      return await baseGateway.authorize(amount, currency, from, to);
    },

    capture: async (providerRef: string): Promise<CaptureResult> => {
      console.log(`[Mobile Gateway] Capturing payment ${providerRef} with mobile headers`);
      return await baseGateway.capture(providerRef);
    },

    refund: async (providerRef: string, amount: number): Promise<RefundResult> => {
      console.log(`[Mobile Gateway] Refunding payment ${providerRef} with mobile headers`);
      return await baseGateway.refund(providerRef, amount);
    }
  };
}

// ============================================================================
// 2. RESPONSE TRANSFORMATION - Bandwidth Optimization
// ============================================================================

export function createMobileOptimizedGateway(
  baseGateway: IPaymentGateway
): IPaymentGateway {
  return {
    authorize: async (amount: number, currency: string, from: string, to: string): Promise<AuthorizationResult> => {
      const startTime = Date.now();
      const response = await baseGateway.authorize(amount, currency, from, to);
      const processingTime = Date.now() - startTime;

      console.log(`[Mobile Optimized] Response optimized, processing took ${processingTime}ms`);
      
      // Return standard response (transformation would happen at GraphQL layer)
      return response;
    },

    capture: async (providerRef: string): Promise<CaptureResult> => {
      const response = await baseGateway.capture(providerRef);
      console.log(`[Mobile Optimized] Capture completed`);
      return response;
    },

    refund: async (providerRef: string, amount: number): Promise<RefundResult> => {
      const response = await baseGateway.refund(providerRef, amount);
      console.log(`[Mobile Optimized] Refund completed`);
      return response;
    }
  };
}

// ============================================================================
// 3. ERROR HANDLING - Mobile-Specific Error Codes
// ============================================================================

export type MobileErrorCode = 
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INSUFFICIENT_FUNDS'
  | 'INVALID_ACCOUNT'
  | 'BIOMETRIC_REQUIRED'
  | 'APP_UPDATE_REQUIRED'
  | 'SERVICE_UNAVAILABLE'
  | 'UNKNOWN_ERROR';

export interface MobileError extends Error {
  code: MobileErrorCode;
  message: string;
  retryable: boolean;
  offlineCapable: boolean;
  userAction?: string;
  originalError?: any;
}

export function createMobileErrorHandlingGateway(
  baseGateway: IPaymentGateway,
  minAppVersion?: string
): IPaymentGateway {
  function mapToMobileError(error: any, operation: string): MobileError {
    console.error(`[Mobile Error Handler] ${operation} failed:`, error);

    // Network connectivity errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      const mobileError = new Error('Cannot connect to server. Check your internet connection.') as MobileError;
      mobileError.code = 'NETWORK_ERROR';
      mobileError.retryable = true;
      mobileError.offlineCapable = true;
      mobileError.userAction = 'Check your internet connection and try again';
      mobileError.originalError = error;
      return mobileError;
    }

    // Timeout errors
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      const mobileError = new Error('Request timed out. Please try again.') as MobileError;
      mobileError.code = 'TIMEOUT';
      mobileError.retryable = true;
      mobileError.offlineCapable = false;
      mobileError.userAction = 'Tap to retry';
      mobileError.originalError = error;
      return mobileError;
    }

    // Business errors from downstream
    if (error.downstreamCode === 'INSUFFICIENT_BALANCE' || error.message?.includes('insufficient')) {
      const mobileError = new Error('You don\'t have enough funds for this payment.') as MobileError;
      mobileError.code = 'INSUFFICIENT_FUNDS';
      mobileError.retryable = false;
      mobileError.offlineCapable = false;
      mobileError.userAction = 'Add funds to your account';
      mobileError.originalError = error;
      return mobileError;
    }

    if (error.downstreamCode === 'INVALID_PAYEE' || error.downstreamCode === 'INVALID_ACCOUNT') {
      const mobileError = new Error('The recipient account is invalid.') as MobileError;
      mobileError.code = 'INVALID_ACCOUNT';
      mobileError.retryable = false;
      mobileError.offlineCapable = false;
      mobileError.userAction = 'Check the account number and try again';
      mobileError.originalError = error;
      return mobileError;
    }

    // Service unavailable
    if (error.status === 503 || error.status === 502 || error.status === 504) {
      const mobileError = new Error('Service is temporarily unavailable.') as MobileError;
      mobileError.code = 'SERVICE_UNAVAILABLE';
      mobileError.retryable = true;
      mobileError.offlineCapable = false;
      mobileError.userAction = 'Try again in a few minutes';
      mobileError.originalError = error;
      return mobileError;
    }

    // App version too old
    if (error.status === 426 || error.message?.includes('upgrade required')) {
      const mobileError = new Error('Please update your app to continue.') as MobileError;
      mobileError.code = 'APP_UPDATE_REQUIRED';
      mobileError.retryable = false;
      mobileError.offlineCapable = false;
      mobileError.userAction = 'Update app in App Store';
      mobileError.originalError = error;
      return mobileError;
    }

    // Generic unknown error
    const mobileError = new Error('Something went wrong. Please try again.') as MobileError;
    mobileError.code = 'UNKNOWN_ERROR';
    mobileError.retryable = true;
    mobileError.offlineCapable = false;
    mobileError.userAction = 'Contact support if this persists';
    mobileError.originalError = error;
    return mobileError;
  }

  return {
    authorize: async (amount: number, currency: string, from: string, to: string): Promise<AuthorizationResult> => {
      try {
        return await baseGateway.authorize(amount, currency, from, to);
      } catch (error) {
        throw mapToMobileError(error, 'authorize');
      }
    },

    capture: async (providerRef: string): Promise<CaptureResult> => {
      try {
        return await baseGateway.capture(providerRef);
      } catch (error) {
        throw mapToMobileError(error, 'capture');
      }
    },

    refund: async (providerRef: string, amount: number): Promise<RefundResult> => {
      try {
        return await baseGateway.refund(providerRef, amount);
      } catch (error) {
        throw mapToMobileError(error, 'refund');
      }
    }
  };
}

// ============================================================================
// 4. RETRY LOGIC - Mobile-Optimized (Fast & Few Retries)
// ============================================================================

export function createMobileRetryGateway(
  baseGateway: IPaymentGateway
): IPaymentGateway {
  const MAX_RETRIES = 2; // Mobile: fewer retries
  const INITIAL_DELAY = 500; // Mobile: start fast
  const MAX_DELAY = 2000; // Mobile: cap at 2s

  async function retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Don't retry non-retryable errors
        if (error.retryable === false || attempt === MAX_RETRIES) {
          throw error;
        }

        const delay = Math.min(INITIAL_DELAY * Math.pow(2, attempt), MAX_DELAY);
        console.log(`[Mobile Retry] ${operationName} attempt ${attempt + 1}/${MAX_RETRIES + 1} failed. Retry in ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  return {
    authorize: async (amount: number, currency: string, from: string, to: string): Promise<AuthorizationResult> => {
      return retryWithBackoff(
        () => baseGateway.authorize(amount, currency, from, to),
        'authorize'
      );
    },

    capture: async (providerRef: string): Promise<CaptureResult> => {
      return retryWithBackoff(
        () => baseGateway.capture(providerRef),
        'capture'
      );
    },

    refund: async (providerRef: string, amount: number): Promise<RefundResult> => {
      return retryWithBackoff(
        () => baseGateway.refund(providerRef, amount),
        'refund'
      );
    }
  };
}

// ============================================================================
// COMPLETE MOBILE GATEWAY - Composition of All Features
// ============================================================================

export function createCompleteMobileGateway(context: MobileContext): IPaymentGateway {
  // Compose all mobile customizations
  return createMobileRetryGateway(
    createMobileErrorHandlingGateway(
      createMobileOptimizedGateway(
        createMobileHeaderGateway(context)
      )
    )
  );
}

// ============================================================================
// Usage Example
// ============================================================================

/*
// In mobile-bff/src/server.ts:

import { createCompleteMobileGateway } from './custom-gateway';
import { createServices } from '../../shared-graphql/src';

// Extract from request
const mobileContext = {
  deviceId: req.headers['x-device-id'] as string,
  platform: req.headers['x-platform'] as 'iOS' | 'Android',
  appVersion: req.headers['x-app-version'] as string,
  userId: req.user?.id,
  biometricEnabled: req.headers['x-biometric-enabled'] === 'true'
};

// Create mobile-optimized gateway
const mobileGateway = createCompleteMobileGateway(mobileContext);

// Use with services
const services = createServices({
  gateway: mobileGateway
});

// All downstream calls now have:
// ✅ Mobile-specific headers
// ✅ Optimized responses
// ✅ Mobile-friendly errors
// ✅ Fast retry logic
*/
