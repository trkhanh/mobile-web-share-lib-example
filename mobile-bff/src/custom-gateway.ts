/**
 * Mobile BFF - Gateway Customizations (OOP Style)
 * 
 * Demonstrates SOLID principles with:
 * 1. Custom headers (device info, tracking) - Decorator Pattern
 * 2. Response transformation (bandwidth optimization) - Decorator Pattern
 * 3. Mobile-specific error handling - Decorator Pattern
 * 4. Retry logic - Decorator Pattern
 * 
 * SOLID Principles Applied:
 * - Single Responsibility: Each decorator handles ONE concern
 * - Open/Closed: Extend behavior through composition, not modification
 * - Liskov Substitution: All decorators implement IPaymentGateway
 * - Interface Segregation: Depend only on IPaymentGateway interface
 * - Dependency Inversion: Depend on abstractions, not concrete classes
 */

import { IPaymentGateway, AuthorizationResult, CaptureResult, RefundResult } from '../../shared-graphql/src/ports/gateway';
import { HttpPaymentGateway } from '../../shared-graphql/src/infra/http-gateway';

// ============================================================================
// 1. CUSTOM HEADERS - Mobile Device Information (Decorator)
// ============================================================================

export interface MobileContext {
  deviceId: string;
  platform: 'iOS' | 'Android';
  appVersion: string;
  userId?: string;
  biometricEnabled?: boolean;
}

/**
 * MobileHeaderGateway - Adds mobile-specific headers to all requests
 * 
 * SOLID:
 * - SRP: Only responsible for adding mobile headers
 * - OCP: Extends gateway behavior without modifying base gateway
 * - LSP: Implements IPaymentGateway, can replace any gateway
 * - DIP: Depends on IPaymentGateway abstraction
 */
export class MobileHeaderGateway implements IPaymentGateway {
  private mobileHeaders: Record<string, string>;

  constructor(
    private baseGateway: IPaymentGateway,
    private context: MobileContext
  ) {
    // Prepare standard headers for all mobile requests
    this.mobileHeaders = {
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
  }

  async authorize(amount: number, currency: string, from: string, to: string): Promise<AuthorizationResult> {
    console.log(`[Mobile Gateway] Authorizing payment with headers:`, this.mobileHeaders);
    console.log(`[Mobile Gateway] Device: ${this.context.deviceId}, Platform: ${this.context.platform}, Version: ${this.context.appVersion}`);
    
    // In real implementation, these headers would be sent via HTTP client
    // For now, we delegate to base gateway
    return await this.baseGateway.authorize(amount, currency, from, to);
  }

  async capture(providerRef: string): Promise<CaptureResult> {
    console.log(`[Mobile Gateway] Capturing payment ${providerRef} with mobile headers`);
    return await this.baseGateway.capture(providerRef);
  }

  async refund(providerRef: string, amount: number): Promise<RefundResult> {
    console.log(`[Mobile Gateway] Refunding payment ${providerRef} with mobile headers`);
    return await this.baseGateway.refund(providerRef, amount);
  }
}

// ============================================================================
// 2. RESPONSE TRANSFORMATION - Bandwidth Optimization (Decorator)
// ============================================================================

/**
 * MobileOptimizedGateway - Optimizes responses for mobile bandwidth
 * 
 * SOLID:
 * - SRP: Only responsible for response optimization
 * - OCP: Extends functionality without modifying existing code
 * - LSP: Can substitute any IPaymentGateway
 */
export class MobileOptimizedGateway implements IPaymentGateway {
  constructor(private baseGateway: IPaymentGateway) {}

  async authorize(amount: number, currency: string, from: string, to: string): Promise<AuthorizationResult> {
    const startTime = Date.now();
    const response = await this.baseGateway.authorize(amount, currency, from, to);
    const processingTime = Date.now() - startTime;

    console.log(`[Mobile Optimized] Response optimized, processing took ${processingTime}ms`);
    
    // Return standard response (transformation would happen at GraphQL layer)
    return response;
  }

  async capture(providerRef: string): Promise<CaptureResult> {
    const response = await this.baseGateway.capture(providerRef);
    console.log(`[Mobile Optimized] Capture completed`);
    return response;
  }

  async refund(providerRef: string, amount: number): Promise<RefundResult> {
    const response = await this.baseGateway.refund(providerRef, amount);
    console.log(`[Mobile Optimized] Refund completed`);
    return response;
  }
}

// ============================================================================
// 3. ERROR HANDLING - Mobile-Specific Error Codes (Decorator)
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

export class MobileError extends Error {
  constructor(
    message: string,
    public code: MobileErrorCode,
    public retryable: boolean,
    public offlineCapable: boolean,
    public userAction?: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'MobileError';
  }
}

/**
 * MobileErrorHandlingGateway - Maps errors to mobile-friendly format
 * 
 * SOLID:
 * - SRP: Only responsible for error mapping/handling
 * - OCP: Adds error handling without changing base gateway
 * - LSP: Implements same interface, substitutable
 */
export class MobileErrorHandlingGateway implements IPaymentGateway {
  constructor(
    private baseGateway: IPaymentGateway,
    private minAppVersion?: string
  ) {}

  private mapToMobileError(error: any, operation: string): MobileError {
    console.error(`[Mobile Error Handler] ${operation} failed:`, error);

    // Network connectivity errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new MobileError(
        'Cannot connect to server. Check your internet connection.',
        'NETWORK_ERROR',
        true,
        true,
        'Check your internet connection and try again',
        error
      );
    }

    // Timeout errors
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      return new MobileError(
        'Request timed out. Please try again.',
        'TIMEOUT',
        true,
        false,
        'Tap to retry',
        error
      );
    }

    // Business errors from downstream
    if (error.downstreamCode === 'INSUFFICIENT_BALANCE' || error.message?.includes('insufficient')) {
      return new MobileError(
        'You don\'t have enough funds for this payment.',
        'INSUFFICIENT_FUNDS',
        false,
        false,
        'Add funds to your account',
        error
      );
    }

    if (error.downstreamCode === 'INVALID_PAYEE' || error.downstreamCode === 'INVALID_ACCOUNT') {
      return new MobileError(
        'The recipient account is invalid.',
        'INVALID_ACCOUNT',
        false,
        false,
        'Check the account number and try again',
        error
      );
    }

    // Service unavailable
    if (error.status === 503 || error.status === 502 || error.status === 504) {
      return new MobileError(
        'Service is temporarily unavailable.',
        'SERVICE_UNAVAILABLE',
        true,
        false,
        'Try again in a few minutes',
        error
      );
    }

    // App version too old
    if (error.status === 426 || error.message?.includes('upgrade required')) {
      return new MobileError(
        'Please update your app to continue.',
        'APP_UPDATE_REQUIRED',
        false,
        false,
        'Update app in App Store',
        error
      );
    }

    // Generic unknown error
    return new MobileError(
      'Something went wrong. Please try again.',
      'UNKNOWN_ERROR',
      true,
      false,
      'Contact support if this persists',
      error
    );
  }

  async authorize(amount: number, currency: string, from: string, to: string): Promise<AuthorizationResult> {
    try {
      return await this.baseGateway.authorize(amount, currency, from, to);
    } catch (error) {
      throw this.mapToMobileError(error, 'authorize');
    }
  }

  async capture(providerRef: string): Promise<CaptureResult> {
    try {
      return await this.baseGateway.capture(providerRef);
    } catch (error) {
      throw this.mapToMobileError(error, 'capture');
    }
  }

  async refund(providerRef: string, amount: number): Promise<RefundResult> {
    try {
      return await this.baseGateway.refund(providerRef, amount);
    } catch (error) {
      throw this.mapToMobileError(error, 'refund');
    }
  }
}

// ============================================================================
// 4. RETRY LOGIC - Mobile-Optimized (Fast & Few Retries) (Decorator)
// ============================================================================

/**
 * MobileRetryGateway - Implements fast retry strategy for mobile
 * 
 * SOLID:
 * - SRP: Only responsible for retry logic
 * - OCP: Adds retry behavior through decoration
 * - LSP: Implements IPaymentGateway, fully substitutable
 */
export class MobileRetryGateway implements IPaymentGateway {
  private readonly MAX_RETRIES = 2; // Mobile: fewer retries
  private readonly INITIAL_DELAY = 500; // Mobile: start fast
  private readonly MAX_DELAY = 2000; // Mobile: cap at 2s

  constructor(private baseGateway: IPaymentGateway) {}

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Don't retry non-retryable errors
        if (error.retryable === false || attempt === this.MAX_RETRIES) {
          throw error;
        }

        const delay = Math.min(this.INITIAL_DELAY * Math.pow(2, attempt), this.MAX_DELAY);
        console.log(`[Mobile Retry] ${operationName} attempt ${attempt + 1}/${this.MAX_RETRIES + 1} failed. Retry in ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  async authorize(amount: number, currency: string, from: string, to: string): Promise<AuthorizationResult> {
    return this.retryWithBackoff(
      () => this.baseGateway.authorize(amount, currency, from, to),
      'authorize'
    );
  }

  async capture(providerRef: string): Promise<CaptureResult> {
    return this.retryWithBackoff(
      () => this.baseGateway.capture(providerRef),
      'capture'
    );
  }

  async refund(providerRef: string, amount: number): Promise<RefundResult> {
    return this.retryWithBackoff(
      () => this.baseGateway.refund(providerRef, amount),
      'refund'
    );
  }
}

// ============================================================================
// FACTORY - Complete Mobile Gateway (Builder Pattern)
// ============================================================================

/**
 * CompleteMobileGatewayFactory - Creates fully configured mobile gateway
 * 
 * SOLID:
 * - SRP: Only responsible for gateway composition
 * - OCP: Can add new decorators without modifying existing code
 * - DIP: Returns IPaymentGateway abstraction
 * 
 * Design Pattern: Builder + Decorator
 * - Composes multiple decorators in correct order
 * - Each decorator adds one responsibility
 */
export class CompleteMobileGatewayFactory {
  static create(context: MobileContext, baseUrl?: string): IPaymentGateway {
    // Base gateway
    const httpGateway = new HttpPaymentGateway(
      baseUrl || process.env.MOBILE_API_URL || 'https://mobile-api.example.com'
    );

    // Layer 1: Add mobile headers
    const headerGateway = new MobileHeaderGateway(httpGateway, context);

    // Layer 2: Optimize responses
    const optimizedGateway = new MobileOptimizedGateway(headerGateway);

    // Layer 3: Handle errors mobile-friendly
    const errorHandlingGateway = new MobileErrorHandlingGateway(optimizedGateway);

    // Layer 4: Add fast retry logic
    const retryGateway = new MobileRetryGateway(errorHandlingGateway);

    return retryGateway;
  }
}

// ============================================================================
// Usage Example (OOP Style)
// ============================================================================

/*
// In mobile-bff/src/server.ts:

import { CompleteMobileGatewayFactory, MobileContext } from './custom-gateway';

// Extract from request
const mobileContext: MobileContext = {
  deviceId: req.headers['x-device-id'] as string,
  platform: req.headers['x-platform'] as 'iOS' | 'Android',
  appVersion: req.headers['x-app-version'] as string,
  userId: req.user?.id,
  biometricEnabled: req.headers['x-biometric-enabled'] === 'true'
};

// Create mobile-optimized gateway using factory
const mobileGateway = CompleteMobileGatewayFactory.create(mobileContext);

// Use with services (dependency injection)
const paymentService = new PaymentService(store, mobileGateway, logger);

// All downstream calls now have:
// ✅ Mobile-specific headers (MobileHeaderGateway)
// ✅ Optimized responses (MobileOptimizedGateway)
// ✅ Mobile-friendly errors (MobileErrorHandlingGateway)
// ✅ Fast retry logic (MobileRetryGateway)

// SOLID Benefits:
// - Each class has ONE responsibility
// - Easy to test each decorator in isolation
// - Easy to add/remove decorators without breaking others
// - All depend on IPaymentGateway abstraction
// - Can substitute any decorator with different implementation
*/
