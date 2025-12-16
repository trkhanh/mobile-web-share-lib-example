import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { payeeTypeDefs } from '../../shared-graphql/src/graphql/payee-schema';
import { paymentTypeDefs } from '../../shared-graphql/src/graphql/payment-schema';
import { createServices } from '../../shared-graphql/src/factories/service-factory';
import { makePayeeResolvers } from '../../shared-graphql/src/graphql/payee-resolvers';
import { makePaymentResolvers } from '../../shared-graphql/src/graphql/payment-resolvers';
import { createPaymentService } from '../../shared-graphql/src/services/payment-service-functional';
import { ILogger } from '../../shared-graphql/src/ports/logger';
import { IPaymentStore } from '../../shared-graphql/src/ports/payment-store';
import { Payment } from '../../shared-graphql/src/types/payment';
import { createCompleteWebGateway, WebContext } from './custom-gateway';

/**
 * WEB BFF - Extension Scenarios with Gateway Customization
 * 
 * Shows different extension patterns for web consumers:
 * 1. Session-aware logging with user context
 * 2. Redis-backed payment store (simulated)
 * 3. Audit trail for compliance
 * 4. Rate limiting and fraud detection
 * 5. Web-specific GraphQL fields (pagination, sorting)
 * 6. **NEW** Custom gateway with JWT auth, tracing, enrichment, and detailed errors
 */

// Scenario 1: Session-aware logger with request tracing
const createWebLogger = (sessionId?: string): ILogger => ({
  info: (message: string, meta?: any) => {
    console.log(`[WEB] [SESSION:${sessionId}] [INFO]`, message, meta ?? '');
  },
  warn: (message: string, meta?: any) => {
    console.warn(`[WEB] [SESSION:${sessionId}] [WARN]`, message, meta ?? '');
  },
  error: (message: string, meta?: any) => {
    console.error(`[WEB] [SESSION:${sessionId}] [ERROR]`, message, meta ?? '');
    // Could send to error tracking (Sentry, etc.)
  }
});

// Scenario 6: Web Gateway with JWT Auth, Tracing, Enrichment, and Detailed Errors
const createWebGatewayForContext = (
  getUserToken: () => Promise<string>,
  context: WebContext,
  getRequestId: () => string
) => {
  console.log(`\n🚀 [WEB BFF] Creating custom gateway for session ${context.sessionId}`);
  console.log(`   User: ${context.userId}`);
  console.log(`   IP: ${context.ipAddress}`);
  console.log(`   Features: JWT Auth ✅ | Tracing ✅ | Audit logs ✅ | Detailed errors ✅ | Retry logic ✅\n`);
  
  return createCompleteWebGateway(getUserToken, context, getRequestId);
};

// Scenario 2: Redis-backed payment store (simulated for demo)
const createRedisPaymentStore = (): IPaymentStore => {
  // In real app: use Redis client
  const cache = new Map<string, Payment>();
  
  return {
    create: async (payload: Omit<Payment, 'id' | 'status' | 'createdAt'>): Promise<Payment> => {
      const id = `p_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const createdAt = new Date().toISOString();
      const payment: Payment = { id, ...payload, status: 'PENDING', createdAt } as Payment;
      
      // Web-specific: Store in Redis with TTL
      cache.set(id, payment);
      console.log(`[Redis] SET payment:${id} EX 3600`);
      
      return payment;
    },
    
    updateStatus: async (paymentId: string, status: Payment['status'], providerRef?: string): Promise<void> => {
      const p = cache.get(paymentId);
      if (!p) throw new Error('NOT_FOUND');
      p.status = status;
      if (providerRef) p.providerRef = providerRef;
      cache.set(paymentId, p);
      console.log(`[Redis] UPDATE payment:${paymentId} status=${status}`);
    },
    
    get: async (paymentId: string): Promise<Payment | null> => {
      console.log(`[Redis] GET payment:${paymentId}`);
      return cache.get(paymentId) ?? null;
    }
  };
};

// Scenario 3: Audit trail wrapper
interface AuditEvent {
  timestamp: string;
  action: string;
  userId?: string;
  metadata: any;
}

const auditLog: AuditEvent[] = [];

function logAudit(action: string, userId: string | undefined, metadata: any) {
  auditLog.push({
    timestamp: new Date().toISOString(),
    action,
    userId,
    metadata
  });
  console.log(`[AUDIT] ${action}`, { userId, metadata });
}

// Scenario 4: Rate limiting (simplified)
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(userId: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const userRequests = rateLimitMap.get(userId) || [];
  
  // Remove old requests outside window
  const recentRequests = userRequests.filter(time => now - time < windowMs);
  
  if (recentRequests.length >= limit) {
    return false; // Rate limit exceeded
  }
  
  recentRequests.push(now);
  rateLimitMap.set(userId, recentRequests);
  return true;
}

// Create services with web-specific overrides
const baseServices = createServices({
  logger: createWebLogger('default-session'),
  paymentStore: createRedisPaymentStore()
});

// Scenario 5: Wrap services with web-specific business logic
const webPaymentService = {
  ...baseServices.paymentService,
  
  // Add fraud detection layer
  createPaymentWithFraudCheck: async (input: any, userId: string) => {
    logAudit('PAYMENT_ATTEMPT', userId, { amount: input.amount, currency: input.currency });
    
    // Web-specific: Check rate limit
    if (!checkRateLimit(userId, 10, 60000)) { // 10 requests per minute
      logAudit('RATE_LIMIT_EXCEEDED', userId, { input });
      return { success: false, error: 'RATE_LIMIT_EXCEEDED' };
    }
    
    // Web-specific: Fraud detection
    if (input.amount > 10000) {
      logAudit('HIGH_VALUE_TRANSACTION', userId, { amount: input.amount });
      // Could trigger additional verification
    }
    
    const result = await baseServices.paymentService.createPayment(input);
    
    if (result.success) {
      logAudit('PAYMENT_SUCCESS', userId, { paymentId: result.paymentId });
    } else {
      logAudit('PAYMENT_FAILED', userId, { reason: result.reason });
    }
    
    return result;
  },
  
  // Web-specific: Get payment history with pagination
  getPaymentHistory: async (userId: string, page: number = 1, limit: number = 20) => {
    // In real app: query from database with pagination
    logAudit('GET_PAYMENT_HISTORY', userId, { page, limit });
    return {
      payments: [],
      total: 0,
      page,
      limit,
      hasMore: false
    };
  }
};

// Get base resolvers
const basePayeeResolvers = makePayeeResolvers(baseServices);
const basePaymentResolvers = makePaymentResolvers(baseServices);

// Scenario 6: Extend resolvers with web-specific features
const webResolvers = {
  Query: {
    ...basePayeeResolvers.Query,
    ...basePaymentResolvers.Query,
    
    // Override with session context
    validatePayee: async (_: any, { input }: any, context: any) => {
      const sessionId = context.sessionId;
      const userId = context.userId;
      
      logAudit('VALIDATE_PAYEE', userId, input);
      
      const result = await baseServices.payeeService.validatePayee(input);
      
      return {
        ...result,
        validationId: `val_${Date.now()}`,
        sessionId,
        timestamp: new Date().toISOString(),
        // Web-specific: suggest similar payees from history
        suggestedPayees: [] // Could query user's previous payees
      };
    },
    
    // Web-only: get payment history with pagination
    paymentHistory: async (_: any, { page, limit }: any, context: any) => {
      return await webPaymentService.getPaymentHistory(context.userId, page, limit);
    },
    
    // Web-only: get audit trail
    getAuditTrail: async (_: any, { userId, fromDate, toDate }: any, context: any) => {
      // Admin only - check permissions
      if (!context.isAdmin) {
        throw new Error('UNAUTHORIZED');
      }
      
      return auditLog.filter(event => {
        if (userId && event.userId !== userId) return false;
        if (fromDate && event.timestamp < fromDate) return false;
        if (toDate && event.timestamp > toDate) return false;
        return true;
      });
    }
  },
  
  Mutation: {
    ...basePaymentResolvers.Mutation,
    
    // Override with fraud detection
    createPayment: async (_: any, { input }: any, context: any) => {
      return await webPaymentService.createPaymentWithFraudCheck(input, context.userId);
    },
    
    // Web-only: batch payment creation
    createBatchPayments: async (_: any, { inputs }: any, context: any) => {
      logAudit('BATCH_PAYMENT_ATTEMPT', context.userId, { count: inputs.length });
      
      const results = await Promise.all(
        inputs.map((input: any) => 
          webPaymentService.createPaymentWithFraudCheck(input, context.userId)
        )
      );
      
      return {
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };
    }
  }
};

// Web-specific GraphQL extensions
const webTypeDefs = `
extend type ValidatePayeeResult {
  validationId: ID!
  sessionId: String
  timestamp: String
  suggestedPayees: [String!]
}

type PaymentHistoryResult {
  payments: [Payment!]!
  total: Int!
  page: Int!
  limit: Int!
  hasMore: Boolean!
}

type AuditEvent {
  timestamp: String!
  action: String!
  userId: String
  metadata: String
}

type BatchPaymentResult {
  successful: Int!
  failed: Int!
  results: [CreatePaymentResult!]!
}

extend type Query {
  paymentHistory(page: Int, limit: Int): PaymentHistoryResult!
  getAuditTrail(userId: String, fromDate: String, toDate: String): [AuditEvent!]!
}

extend type Mutation {
  createBatchPayments(inputs: [CreatePaymentInput!]!): BatchPaymentResult!
}
`;

async function start() {
  const app = express();
  
  // Middleware to extract session/user context
  app.use((req, res, next) => {
    (req as any).sessionId = req.headers['x-session-id'] || 'demo-session-123';
    (req as any).userId = req.headers['x-user-id'] || 'demo-user';
    (req as any).isAdmin = req.headers['x-role'] === 'admin';
    (req as any).requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    next();
  });

  // Demo: Create services with web-customized gateway
  const getUserToken = async () => 'demo-jwt-token-xyz123';
  
  const webContext: WebContext = {
    userId: 'demo-user',
    sessionId: 'demo-session-123',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Web Demo)',
    correlationId: 'demo-correlation-456'
  };

  const webGateway = createWebGatewayForContext(
    getUserToken,
    webContext,
    () => `req-${Date.now()}`
  );

  const redisStore = createRedisPaymentStore();

  const webServices = createServices({
    paymentGateway: webGateway,
    logger: createWebLogger(webContext.sessionId),
    paymentStore: redisStore
  });

  const schema = makeExecutableSchema({ 
    typeDefs: [payeeTypeDefs, paymentTypeDefs, webTypeDefs], 
    resolvers: webResolvers as any 
  });

  const server = new ApolloServer({ 
    schema,
    context: ({ req }: any) => ({
      sessionId: req.sessionId,
      userId: req.userId,
      isAdmin: req.isAdmin,
      requestId: req.requestId,
      // Provide services with customized gateway
      services: webServices
    })
  });
  
  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  app.listen(4002, () => {
    console.log('🚀 Web BFF ready at http://localhost:4002/graphql');
    console.log(`
    🌐 Web-specific extensions:
    ✅ Session-aware logging
    ✅ Redis-backed storage
    ✅ Complete audit trail
    ✅ Rate limiting & fraud detection
    ✅ Payment history with pagination
    ✅ Batch payment operations
    
    🔧 Gateway Customizations:
    ✅ JWT authentication headers
    ✅ Distributed tracing (correlation ID, trace ID)
    ✅ Response enrichment with audit logs
    ✅ Detailed error messages with recovery steps
    ✅ Patient retry logic (1s-10s, max 3 attempts)
    `);
  });
}

start().catch(e => console.error(e));
