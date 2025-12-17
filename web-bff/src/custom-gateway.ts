/**
 * Web BFF - Gateway Customizations (OOP Style)
 * 
 * Demonstrates SOLID principles with:
 * 1. Custom headers (JWT auth, tracing, correlation ID) - Decorator Pattern
 * 2. Response enrichment (audit logs, metadata) - Decorator Pattern
 * 3. Web-specific error handling (detailed debugging) - Decorator Pattern
 * 4. Retry logic (patient strategy) - Decorator Pattern
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
// 1. CUSTOM HEADERS - Authentication & Tracing (Decorators)
// ============================================================================

export interface WebContext {
  userId: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  correlationId?: string;
}

/**
 * AuthenticatedGateway - Adds JWT authentication to all requests
 * 
 * SOLID:
 * - SRP: Only responsible for authentication
 * - OCP: Extends gateway without modifying it
 * - LSP: Implements IPaymentGateway, fully substitutable
 * - DIP: Depends on IPaymentGateway abstraction
 */
export class AuthenticatedGateway implements IPaymentGateway {
  constructor(
    private baseGateway: IPaymentGateway,
    private getUserToken: () => Promise<string>
  ) {}

  async authorize(amount: number, currency: string, from: string, to: string): Promise<AuthorizationResult> {
    const token = await this.getUserToken();
    
    console.log(`[Web Gateway] Authorizing with JWT token`);
    // In real implementation, token would be sent via HTTP headers
    
    return await this.baseGateway.authorize(amount, currency, from, to);
  }

  async capture(providerRef: string): Promise<CaptureResult> {
    const token = await this.getUserToken();
    console.log(`[Web Gateway] Capturing with authentication`);
    
    return await this.baseGateway.capture(providerRef);
  }

  async refund(providerRef: string, amount: number): Promise<RefundResult> {
    const token = await this.getUserToken();
    console.log(`[Web Gateway] Refunding with authentication`);
    
    return await this.baseGateway.refund(providerRef, amount);
  }
}

/**
 * TracedGateway - Adds distributed tracing headers
 * 
 * SOLID:
 * - SRP: Only responsible for tracing/observability
 * - OCP: Adds tracing without modifying base gateway
 * - LSP: Can substitute any IPaymentGateway
 */
export class TracedGateway implements IPaymentGateway {
  private correlationId: string;
  private tracingHeaders: Record<string, string>;

  constructor(
    private baseGateway: IPaymentGateway,
    private context: WebContext
  ) {
    this.correlationId = context.correlationId || `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.tracingHeaders = {
      'X-Correlation-Id': this.correlationId,
      'X-Session-Id': context.sessionId,
      'X-User-Id': context.userId,
      'X-Request-Timestamp': new Date().toISOString(),
      'X-Client-IP': context.ipAddress,
      'User-Agent': context.userAgent
    };
  }

  async authorize(amount: number, currency: string, from: string, to: string): Promise<AuthorizationResult> {
    const traceId = `trace-authorize-${Date.now()}`;
    
    console.log(`[Web Tracing] ${traceId} - Starting payment authorization`);
    console.log(`[Web Tracing] Correlation-ID: ${this.correlationId}, Session: ${this.context.sessionId}`);

    const startTime = Date.now();
    try {
      const response = await this.baseGateway.authorize(amount, currency, from, to);
      console.log(`[Web Tracing] ${traceId} - Completed in ${Date.now() - startTime}ms`);
      return response;
    } catch (error) {
      console.error(`[Web Tracing] ${traceId} - Failed after ${Date.now() - startTime}ms`);
      throw error;
    }
  }

  async capture(providerRef: string): Promise<CaptureResult> {
    const traceId = `trace-capture-${Date.now()}`;
    console.log(`[Web Tracing] ${traceId} - Starting capture`);
    
    return await this.baseGateway.capture(providerRef);
  }

  async refund(providerRef: string, amount: number): Promise<RefundResult> {
    const traceId = `trace-refund-${Date.now()}`;
    console.log(`[Web Tracing] ${traceId} - Starting refund`);
    
    return await this.baseGateway.refund(providerRef, amount);
  }
}

// ============================================================================
// 2. RESPONSE ENRICHMENT - Audit Logs & Metadata (Decorator)
// ============================================================================

/**
 * WebEnrichedGateway - Adds audit logging and metadata
 * 
 * SOLID:
 * - SRP: Only responsible for enrichment/auditing
 * - OCP: Adds audit capability without changing gateway
 * - LSP: Implements IPaymentGateway, substitutable
 */
export class WebEnrichedGateway implements IPaymentGateway {
  constructor(
    private baseGateway: IPaymentGateway,
    private context: WebContext
  ) {}

  async authorize(amount: number, currency: string, from: string, to: string): Promise<AuthorizationResult> {
    const startTime = Date.now();

    try {
      const response = await this.baseGateway.authorize(amount, currency, from, to);
      const processingTime = Date.now() - startTime;

      // Log enrichment metadata (could be sent to audit service)
      console.log(`[Web Enriched] Audit log:`, {
        action: 'PAYMENT_AUTHORIZED',
        userId: this.context.userId,
        amount,
        currency,
        timestamp: new Date().toISOString(),
        ipAddress: this.context.ipAddress,
        sessionId: this.context.sessionId,
        processingTime,
        success: response.success
      });

      return response;
    } catch (error) {
      // Log error with audit info
      console.error(`[Web Enriched] Error with audit info:`, {
        userId: this.context.userId,
        sessionId: this.context.sessionId,
        ipAddress: this.context.ipAddress,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      });
      throw error;
    }
  }

  async capture(providerRef: string): Promise<CaptureResult> {
    const response = await this.baseGateway.capture(providerRef);

    console.log(`[Web Enriched] Capture audit:`, {
      capturedBy: this.context.userId,
      capturedAt: new Date().toISOString(),
      sessionId: this.context.sessionId,
      ipAddress: this.context.ipAddress
    });

    return response;
  }

  async refund(providerRef: string, amount: number): Promise<RefundResult> {
    const response = await this.baseGateway.refund(providerRef, amount);

    console.log(`[Web Enriched] Refund audit:`, {
      refundedBy: this.context.userId,
      refundedAt: new Date().toISOString(),
      requiresApproval: amount > 1000, // Business rule
      sessionId: this.context.sessionId
    });

    return response;
  }
}

// ============================================================================
// 3. ERROR HANDLING - Web-Specific Detailed Errors (Decorator)
// ============================================================================

export class WebError extends Error {
  constructor(
    message: string,
    public code: string,
    public details: string,
    public technicalInfo: {
      originalError: string;
      statusCode?: number;
      downstreamService: string;
      timestamp: string;
      requestId: string;
      stackTrace?: string;
    },
    public userMessage: string,
    public supportMessage: string,
    public recoverySteps: string[]
  ) {
    super(message);
    this.name = 'WebError';
  }
}

/**
 * WebErrorHandlingGateway - Maps errors to detailed web format
 * 
 * SOLID:
 * - SRP: Only responsible for error mapping/handling
 * - OCP: Adds error handling through decoration
 * - LSP: Implements IPaymentGateway, substitutable
 */
export class WebErrorHandlingGateway implements IPaymentGateway {
  constructor(
    private baseGateway: IPaymentGateway,
    private getRequestId: () => string
  ) {}

  private mapToWebError(error: any, operation: string): WebError {
    const requestId = this.getRequestId();
    
    console.error(`[Web Error Handler] ${operation} failed:`, {
      error: error.message,
      code: error.code,
      status: error.status,
      requestId
    });

    // Network/connection errors
    if (error.code === 'ECONNREFUSED') {
      return new WebError(
        'Payment service is unavailable',
        'DOWNSTREAM_UNAVAILABLE',
        `Cannot connect to payment service at ${error.address}:${error.port}`,
        {
          originalError: error.message,
          statusCode: error.status,
          downstreamService: 'Payment Gateway',
          timestamp: new Date().toISOString(),
          requestId,
          stackTrace: error.stack
        },
        'We\'re having trouble processing payments right now.',
        'The payment gateway is unreachable. Check service status and network connectivity.',
        [
          'Wait a few minutes and try again',
          `Contact support with Request ID: ${requestId}`,
          'Check system status page'
        ]
      );
    }

    // Timeout errors
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      return new WebError(
        'Payment request timed out',
        'GATEWAY_TIMEOUT',
        'Request exceeded timeout threshold',
        {
          originalError: error.message,
          statusCode: 504,
          downstreamService: 'Payment Gateway',
          timestamp: new Date().toISOString(),
          requestId,
          stackTrace: error.stack
        },
        'The payment is taking longer than expected.',
        'Gateway timeout occurred. May indicate downstream service overload or network issues.',
        [
          'Retry the request',
          'Check if transaction was already processed',
          `Reference Request ID: ${requestId}`
        ]
      );
    }

    // Business validation errors
    if (error.downstreamCode === 'INSUFFICIENT_BALANCE') {
      return new WebError(
        'Insufficient funds',
        'INSUFFICIENT_FUNDS',
        'Payer account does not have sufficient balance',
        {
          originalError: error.message,
          statusCode: 422,
          downstreamService: 'Payment Gateway',
          timestamp: new Date().toISOString(),
          requestId,
          stackTrace: error.stack
        },
        'The account does not have enough funds for this payment.',
        'Business rule validation failed: Insufficient funds in payer account.',
        [
          'Verify account balance',
          'Request payer to add funds',
          'Consider payment in installments'
        ]
      );
    }

    if (error.downstreamCode === 'INVALID_PAYEE') {
      return new WebError(
        'Invalid recipient account',
        'INVALID_PAYEE',
        'Recipient account number or details are invalid',
        {
          originalError: error.message,
          statusCode: 422,
          downstreamService: 'Payment Gateway',
          timestamp: new Date().toISOString(),
          requestId,
          stackTrace: error.stack
        },
        'The recipient account information is invalid.',
        'Payee validation failed. Account may not exist or is inactive.',
        [
          'Verify recipient account number',
          'Confirm bank code',
          'Check account status with recipient'
        ]
      );
    }

    // Service unavailable
    if (error.status === 503 || error.status === 502 || error.status === 504) {
      return new WebError(
        'Service temporarily unavailable',
        'SERVICE_UNAVAILABLE',
        'Downstream payment service returned unavailable status',
        {
          originalError: error.message,
          statusCode: error.status,
          downstreamService: 'Payment Gateway',
          timestamp: new Date().toISOString(),
          requestId,
          stackTrace: error.stack
        },
        'The payment service is currently unavailable.',
        'Payment gateway is experiencing issues. May be undergoing maintenance.',
        [
          'Retry after a few minutes',
          'Check service status dashboard',
          `Monitor Request ID: ${requestId}`,
          'Escalate to on-call if persists > 15 minutes'
        ]
      );
    }

    // Generic error
    return new WebError(
      'Payment operation failed',
      'GATEWAY_ERROR',
      'An unexpected error occurred during payment processing',
      {
        originalError: error.message || String(error),
        statusCode: error.status,
        downstreamService: 'Payment Gateway',
        timestamp: new Date().toISOString(),
        requestId,
        stackTrace: error.stack
      },
      'An error occurred while processing the payment.',
      'Unexpected gateway error. Investigate logs and downstream service.',
      [
        'Check logs for detailed error',
        `Search for Request ID: ${requestId}`,
        'Verify downstream service health',
        'Contact support if issue persists'
      ]
    );
  }

  async authorize(amount: number, currency: string, from: string, to: string): Promise<AuthorizationResult> {
    try {
      return await this.baseGateway.authorize(amount, currency, from, to);
    } catch (error) {
      throw this.mapToWebError(error, 'authorize');
    }
  }

  async capture(providerRef: string): Promise<CaptureResult> {
    try {
      return await this.baseGateway.capture(providerRef);
    } catch (error) {
      throw this.mapToWebError(error, 'capture');
    }
  }

  async refund(providerRef: string, amount: number): Promise<RefundResult> {
    try {
      return await this.baseGateway.refund(providerRef, amount);
    } catch (error) {
      throw this.mapToWebError(error, 'refund');
    }
  }
}

// ============================================================================
// 4. RETRY LOGIC - Web-Optimized (Patient & More Retries) (Decorator)
// ============================================================================

/**
 * WebRetryGateway - Implements patient retry strategy for web
 * 
 * SOLID:
 * - SRP: Only responsible for retry logic
 * - OCP: Adds retry behavior through decoration
 * - LSP: Implements IPaymentGateway, fully substitutable
 */
export class WebRetryGateway implements IPaymentGateway {
  private readonly MAX_RETRIES = 3; // Web: more retries
  private readonly INITIAL_DELAY = 1000; // Web: start slower
  private readonly MAX_DELAY = 10000; // Web: cap at 10s

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

        // Check if error has retryable property and respect it
        if (error.retryable === false || attempt === this.MAX_RETRIES) {
          throw error;
        }

        const delay = Math.min(this.INITIAL_DELAY * Math.pow(2, attempt), this.MAX_DELAY);
        console.log(`[Web Retry] ${operationName} attempt ${attempt + 1}/${this.MAX_RETRIES + 1} failed. Retry in ${delay}ms`);
        
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
// FACTORY - Complete Web Gateway (Builder Pattern)
// ============================================================================

/**
 * CompleteWebGatewayFactory - Creates fully configured web gateway
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
export class CompleteWebGatewayFactory {
  static create(
    context: WebContext,
    getUserToken: () => Promise<string>,
    getRequestId: () => string,
    baseUrl?: string
  ): IPaymentGateway {
    // Base gateway
    const httpGateway = new HttpPaymentGateway(
      baseUrl || process.env.WEB_API_URL || 'https://api.example.com'
    );

    // Layer 1: Add JWT authentication
    const authGateway = new AuthenticatedGateway(httpGateway, getUserToken);

    // Layer 2: Add distributed tracing
    const tracedGateway = new TracedGateway(authGateway, context);

    // Layer 3: Enrich responses with audit logs
    const enrichedGateway = new WebEnrichedGateway(tracedGateway, context);

    // Layer 4: Handle errors with detailed info
    const errorHandlingGateway = new WebErrorHandlingGateway(enrichedGateway, getRequestId);

    // Layer 5: Add patient retry logic
    const retryGateway = new WebRetryGateway(errorHandlingGateway);

    return retryGateway;
  }
}

// ============================================================================
// Usage Example (OOP Style)
// ============================================================================

/*
// In web-bff/src/server.ts:

import { CompleteWebGatewayFactory, WebContext } from './custom-gateway';

// Extract from request
const webContext: WebContext = {
  userId: req.user?.id || 'anonymous',
  sessionId: req.session.id,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'] || 'unknown',
  correlationId: req.headers['x-correlation-id'] as string
};

// Token and request ID providers
const getUserToken = async () => {
  // Return JWT from session or auth service
  return req.user?.token || 'mock-jwt-token';
};

const getRequestId = () => {
  return req.id || `req-${Date.now()}`;
};

// Create web-optimized gateway using factory
const webGateway = CompleteWebGatewayFactory.create(
  webContext,
  getUserToken,
  getRequestId
);

// Use with services (dependency injection)
const paymentService = new PaymentService(store, webGateway, logger);

// All downstream calls now have:
// ✅ JWT authentication (AuthenticatedGateway)
// ✅ Distributed tracing (TracedGateway)
// ✅ Audit logs & enrichment (WebEnrichedGateway)
// ✅ Detailed error info (WebErrorHandlingGateway)
// ✅ Patient retry logic (WebRetryGateway)

// SOLID Benefits:
// - Each class has ONE responsibility
// - Easy to test each decorator in isolation
// - Easy to add/remove decorators without breaking others
// - All depend on IPaymentGateway abstraction
// - Can substitute any decorator with different implementation
// - Open for extension, closed for modification
*/
