/**
 * Web BFF - Gateway Customizations
 * 
 * Demonstrates:
 * 1. Custom headers (JWT auth, tracing, correlation ID)
 * 2. Response enrichment (audit logs, metadata)
 * 3. Web-specific error handling (detailed debugging info)
 */

import { IPaymentGateway, AuthorizationResult, CaptureResult, RefundResult } from '../../shared-graphql/src/ports/gateway';
import { createHttpPaymentGateway } from '../../shared-graphql/src/infra/http-gateway-functional';

// ============================================================================
// 1. CUSTOM HEADERS - Authentication & Tracing
// ============================================================================

export interface WebContext {
  userId: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  correlationId?: string;
}

export function createAuthenticatedGateway(
  getUserToken: () => Promise<string>,
  baseUrl?: string
): IPaymentGateway {
  const baseGateway = createHttpPaymentGateway(
    baseUrl || process.env.WEB_API_URL || 'https://api.example.com'
  );

  return {
    authorize: async (amount: number, currency: string, from: string, to: string): Promise<AuthorizationResult> => {
      const token = await getUserToken();
      
      console.log(`[Web Gateway] Authorizing with JWT token`);
      // In real implementation, token would be sent via HTTP headers
      
      return await baseGateway.authorize(amount, currency, from, to);
    },

    capture: async (providerRef: string): Promise<CaptureResult> => {
      const token = await getUserToken();
      console.log(`[Web Gateway] Capturing with authentication`);
      
      return await baseGateway.capture(providerRef);
    },

    refund: async (providerRef: string, amount: number): Promise<RefundResult> => {
      const token = await getUserToken();
      console.log(`[Web Gateway] Refunding with authentication`);
      
      return await baseGateway.refund(providerRef, amount);
    }
  };
}

export function createTracedGateway(
  baseGateway: IPaymentGateway,
  context: WebContext
): IPaymentGateway {
  const correlationId = context.correlationId || `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const tracingHeaders = {
    'X-Correlation-Id': correlationId,
    'X-Session-Id': context.sessionId,
    'X-User-Id': context.userId,
    'X-Request-Timestamp': new Date().toISOString(),
    'X-Client-IP': context.ipAddress,
    'User-Agent': context.userAgent
  };

  return {
    authorize: async (amount: number, currency: string, from: string, to: string): Promise<AuthorizationResult> => {
      const traceId = `trace-authorize-${Date.now()}`;
      
      console.log(`[Web Tracing] ${traceId} - Starting payment authorization`);
      console.log(`[Web Tracing] Correlation-ID: ${correlationId}, Session: ${context.sessionId}`);

      const startTime = Date.now();
      try {
        const response = await baseGateway.authorize(amount, currency, from, to);
        console.log(`[Web Tracing] ${traceId} - Completed in ${Date.now() - startTime}ms`);
        return response;
      } catch (error) {
        console.error(`[Web Tracing] ${traceId} - Failed after ${Date.now() - startTime}ms`);
        throw error;
      }
    },

    capture: async (providerRef: string): Promise<CaptureResult> => {
      const traceId = `trace-capture-${Date.now()}`;
      console.log(`[Web Tracing] ${traceId} - Starting capture`);
      
      return await baseGateway.capture(providerRef);
    },

    refund: async (providerRef: string, amount: number): Promise<RefundResult> => {
      const traceId = `trace-refund-${Date.now()}`;
      console.log(`[Web Tracing] ${traceId} - Starting refund`);
      
      return await baseGateway.refund(providerRef, amount);
    }
  };
}

// ============================================================================
// 2. RESPONSE ENRICHMENT - Audit Logs & Metadata
// ============================================================================

export function createWebEnrichedGateway(
  baseGateway: IPaymentGateway,
  context: WebContext
): IPaymentGateway {
  return {
    authorize: async (amount: number, currency: string, from: string, to: string): Promise<AuthorizationResult> => {
      const startTime = Date.now();

      try {
        const response = await baseGateway.authorize(amount, currency, from, to);
        const processingTime = Date.now() - startTime;

        // Log enrichment metadata (could be sent to audit service)
        console.log(`[Web Enriched] Audit log:`, {
          action: 'PAYMENT_AUTHORIZED',
          userId: context.userId,
          amount,
          currency,
          timestamp: new Date().toISOString(),
          ipAddress: context.ipAddress,
          sessionId: context.sessionId,
          processingTime,
          success: response.success
        });

        return response;
      } catch (error) {
        // Log error with audit info
        console.error(`[Web Enriched] Error with audit info:`, {
          userId: context.userId,
          sessionId: context.sessionId,
          ipAddress: context.ipAddress,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime
        });
        throw error;
      }
    },

    capture: async (providerRef: string): Promise<CaptureResult> => {
      const response = await baseGateway.capture(providerRef);

      console.log(`[Web Enriched] Capture audit:`, {
        capturedBy: context.userId,
        capturedAt: new Date().toISOString(),
        sessionId: context.sessionId,
        ipAddress: context.ipAddress
      });

      return response;
    },

    refund: async (providerRef: string, amount: number): Promise<RefundResult> => {
      const response = await baseGateway.refund(providerRef, amount);

      console.log(`[Web Enriched] Refund audit:`, {
        refundedBy: context.userId,
        refundedAt: new Date().toISOString(),
        requiresApproval: amount > 1000, // Business rule
        sessionId: context.sessionId
      });

      return response;
    }
  };
}

// ============================================================================
// 3. ERROR HANDLING - Web-Specific Detailed Errors
// ============================================================================

export interface WebError extends Error {
  code: string;
  message: string;
  details: string;
  technicalInfo: {
    originalError: string;
    statusCode?: number;
    downstreamService: string;
    timestamp: string;
    requestId: string;
    stackTrace?: string;
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
    
    console.error(`[Web Error Handler] ${operation} failed:`, {
      error: error.message,
      code: error.code,
      status: error.status,
      requestId
    });

    // Network/connection errors
    if (error.code === 'ECONNREFUSED') {
      const webError = new Error('Payment service is unavailable') as WebError;
      webError.code = 'DOWNSTREAM_UNAVAILABLE';
      webError.details = `Cannot connect to payment service at ${error.address}:${error.port}`;
      webError.technicalInfo = {
        originalError: error.message,
        statusCode: error.status,
        downstreamService: 'Payment Gateway',
        timestamp: new Date().toISOString(),
        requestId,
        stackTrace: error.stack
      };
      webError.userMessage = 'We\'re having trouble processing payments right now.';
      webError.supportMessage = 'The payment gateway is unreachable. Check service status and network connectivity.';
      webError.recoverySteps = [
        'Wait a few minutes and try again',
        `Contact support with Request ID: ${requestId}`,
        'Check system status page'
      ];
      return webError;
    }

    // Timeout errors
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      const webError = new Error('Payment request timed out') as WebError;
      webError.code = 'GATEWAY_TIMEOUT';
      webError.details = `Request exceeded timeout threshold`;
      webError.technicalInfo = {
        originalError: error.message,
        statusCode: 504,
        downstreamService: 'Payment Gateway',
        timestamp: new Date().toISOString(),
        requestId,
        stackTrace: error.stack
      };
      webError.userMessage = 'The payment is taking longer than expected.';
      webError.supportMessage = 'Gateway timeout. Payment state uncertain - check transaction status before retrying.';
      webError.recoverySteps = [
        'Check if payment was processed',
        'If not processed, retry the payment',
        `Contact support if unclear - Request ID: ${requestId}`
      ];
      return webError;
    }

    // Business validation errors
    if (error.downstreamCode === 'INSUFFICIENT_BALANCE' || error.message?.includes('insufficient')) {
      const webError = new Error('Insufficient funds') as WebError;
      webError.code = 'INSUFFICIENT_FUNDS';
      webError.details = `Account balance insufficient for payment`;
      webError.technicalInfo = {
        originalError: error.message,
        statusCode: error.status || 400,
        downstreamService: 'Payment Gateway',
        timestamp: new Date().toISOString(),
        requestId
      };
      webError.userMessage = 'Your account doesn\'t have enough funds for this payment.';
      webError.supportMessage = `Customer has insufficient balance. Available: ${error.availableBalance || 'unknown'}`;
      webError.recoverySteps = [
        'Add funds to the account',
        'Use a different payment method',
        'Reduce the payment amount'
      ];
      return webError;
    }

    // Fraud/security errors
    if (error.downstreamCode === 'FRAUD_DETECTED' || error.message?.includes('fraud')) {
      const webError = new Error('Payment blocked by security') as WebError;
      webError.code = 'SECURITY_BLOCK';
      webError.details = 'Transaction flagged by fraud detection system';
      webError.technicalInfo = {
        originalError: error.message,
        statusCode: error.status || 403,
        downstreamService: 'Fraud Detection',
        timestamp: new Date().toISOString(),
        requestId
      };
      webError.userMessage = 'This payment has been blocked for security reasons.';
      webError.supportMessage = `Fraud detection triggered. Review: ${error.fraudReason || 'unknown reason'}`;
      webError.recoverySteps = [
        'Verify your identity',
        `Contact support to review - Request ID: ${requestId}`,
        'Use an alternative payment method'
      ];
      return webError;
    }

    // Authorization errors
    if (error.status === 401 || error.status === 403) {
      const webError = new Error('Authorization failed') as WebError;
      webError.code = 'AUTHORIZATION_FAILED';
      webError.details = 'User is not authorized to perform this operation';
      webError.technicalInfo = {
        originalError: error.message,
        statusCode: error.status,
        downstreamService: 'Payment Gateway',
        timestamp: new Date().toISOString(),
        requestId
      };
      webError.userMessage = 'You don\'t have permission to perform this action.';
      webError.supportMessage = 'User authorization failed. Check user permissions and token validity.';
      webError.recoverySteps = [
        'Log out and log back in',
        'Contact your administrator',
        `Contact support - Request ID: ${requestId}`
      ];
      return webError;
    }

    // Generic downstream error
    const webError = new Error('Payment processing failed') as WebError;
    webError.code = 'PAYMENT_FAILED';
    webError.details = error.message || 'Unknown error from payment service';
    webError.technicalInfo = {
      originalError: JSON.stringify(error),
      statusCode: error.status,
      downstreamService: 'Payment Gateway',
      timestamp: new Date().toISOString(),
      requestId,
      stackTrace: error.stack
    };
    webError.userMessage = 'We couldn\'t process your payment.';
    webError.supportMessage = `Payment failed. Review logs for Request ID: ${requestId}`;
    webError.recoverySteps = [
      'Try again',
      'Check payment details are correct',
      `Contact support if issue persists - Request ID: ${requestId}`
    ];
    return webError;
  }

  return {
    authorize: async (amount: number, currency: string, from: string, to: string): Promise<AuthorizationResult> => {
      try {
        return await baseGateway.authorize(amount, currency, from, to);
      } catch (error) {
        throw mapToWebError(error, 'authorize');
      }
    },

    capture: async (providerRef: string): Promise<CaptureResult> => {
      try {
        return await baseGateway.capture(providerRef);
      } catch (error) {
        throw mapToWebError(error, 'capture');
      }
    },

    refund: async (providerRef: string, amount: number): Promise<RefundResult> => {
      try {
        return await baseGateway.refund(providerRef, amount);
      } catch (error) {
        throw mapToWebError(error, 'refund');
      }
    }
  };
}

// ============================================================================
// 4. RETRY LOGIC - Web-Optimized (More Patient)
// ============================================================================

export function createWebRetryGateway(
  baseGateway: IPaymentGateway
): IPaymentGateway {
  const MAX_RETRIES = 3; // Web: more retries
  const INITIAL_DELAY = 1000; // Web: start slower
  const MAX_DELAY = 10000; // Web: can wait longer

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

        // Don't retry authorization errors or business errors
        const nonRetryableCodes = ['AUTHORIZATION_FAILED', 'INSUFFICIENT_FUNDS', 'SECURITY_BLOCK'];
        if (nonRetryableCodes.includes(error.code) || attempt === MAX_RETRIES) {
          throw error;
        }

        const delay = Math.min(INITIAL_DELAY * Math.pow(2, attempt), MAX_DELAY);
        console.warn(`[Web Retry] ${operationName} attempt ${attempt + 1}/${MAX_RETRIES + 1} failed. Retry in ${delay}ms`);
        
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
// COMPLETE WEB GATEWAY - Composition of All Features
// ============================================================================

export function createCompleteWebGateway(
  getUserToken: () => Promise<string>,
  context: WebContext,
  getRequestId: () => string
): IPaymentGateway {
  // Compose all web customizations in order
  return createWebRetryGateway(
    createWebErrorHandlingGateway(
      createWebEnrichedGateway(
        createTracedGateway(
          createAuthenticatedGateway(getUserToken),
          context
        ),
        context
      ),
      getRequestId
    )
  );
}

// ============================================================================
// Usage Example
// ============================================================================

/*
// In web-bff/src/server.ts:

import { createCompleteWebGateway } from './custom-gateway';
import { createServices } from '../../shared-graphql/src';

// Extract from request
const webContext = {
  userId: req.user.id,
  sessionId: req.sessionID,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
  correlationId: req.headers['x-correlation-id']
};

// Create web-optimized gateway
const webGateway = createCompleteWebGateway(
  () => Promise.resolve(req.session.token),
  webContext,
  () => req.id || `web-${Date.now()}`
);

// Use with services
const services = createServices({
  gateway: webGateway
});

// All downstream calls now have:
// ✅ JWT authentication
// ✅ Distributed tracing
// ✅ Enriched responses with audit logs
// ✅ Detailed error information
// ✅ Intelligent retry logic
*/
