import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { createServices } from '../../shared-graphql/src/factories/service-factory';
import { makePayeeResolvers } from '../../shared-graphql/src/graphql/payee-resolvers';
import { CompleteWebGatewayFactory, WebContext } from './custom-gateway';
import { completeWebSchema } from './custom-schema';

// ============================================================================
// WEB BFF - OOP Gateway Customization Demo
// ============================================================================

// 1. Create web context (normally extracted from request)
const webContext: WebContext = {
  userId: process.env.USER_ID || 'web-user-admin',
  sessionId: process.env.SESSION_ID || 'web-session-demo-456',
  ipAddress: process.env.IP_ADDRESS || '192.168.1.1',
  userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (WebBFF/1.0)',
  correlationId: process.env.CORRELATION_ID || undefined
};

// 2. Token and request ID providers
const getUserToken = async (): Promise<string> => {
  // In real app, fetch from auth service or session
  return process.env.JWT_TOKEN || 'mock-jwt-token-abc123';
};

let requestCounter = 0;
const getRequestId = (): string => {
  requestCounter++;
  return `web-req-${Date.now()}-${requestCounter}`;
};

console.log('\n🚀 Web BFF Gateway Customization (OOP):');
console.log('   ✅ Layer 1: AuthenticatedGateway - JWT authentication');
console.log('   ✅ Layer 2: TracedGateway - Distributed tracing');
console.log('   ✅ Layer 3: WebEnrichedGateway - Audit logs & metadata');
console.log('   ✅ Layer 4: WebErrorHandlingGateway - Detailed error info');
console.log('   ✅ Layer 5: WebRetryGateway - Patient retry (3 attempts, 1s-10s)');
console.log('');

// 3. Create web-optimized gateway using factory (OOP Decorator Pattern)
const webGateway = CompleteWebGatewayFactory.create(
  webContext,
  getUserToken,
  getRequestId
);

// 4. Create shared services with customized gateway (Dependency Injection)
const services = createServices({ paymentGateway: webGateway });

// Get base resolvers from shared library
const baseResolvers = makePayeeResolvers(services);

// ============================================================================
// WEB-SPECIFIC RESOLVERS (OOP: Open/Closed Principle)
// Extends base resolvers without modifying them
// ============================================================================

const webResolvers = {
  Query: {
    ...baseResolvers.Query,
    
    // Override base validatePayee to add web-specific fields
    validatePayee: async (_: any, { input }: any, context: any) => {
      const startTime = Date.now();
      const result = await services.payeeService.validatePayee(input);
      const processingTimeMs = Date.now() - startTime;
      
      // Add web-specific fields (from custom schema extensions)
      return {
        ...result,
        validationId: getRequestId(),
        auditLog: {
          validationId: getRequestId(),
          userId: webContext.userId,
          sessionId: webContext.sessionId,
          ipAddress: webContext.ipAddress,
          userAgent: webContext.userAgent,
          timestamp: new Date().toISOString(),
          processingTimeMs,
          downstreamCalls: [
            {
              service: 'PayeeValidationService',
              operation: 'validate',
              durationMs: processingTimeMs,
              statusCode: 200,
              success: true
            }
          ]
        },
        metadata: {
          requestId: getRequestId(),
          correlationId: webContext.correlationId || 'none',
          environment: process.env.NODE_ENV || 'development',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          region: 'us-east-1',
          datacenter: 'dc1'
        },
        complianceInfo: {
          sanctions: { passed: true, lists: ['OFAC', 'UN'], checkedAt: new Date().toISOString() },
          aml: { passed: true, riskLevel: 'LOW', checkedAt: new Date().toISOString() },
          pep: { isPEP: false, category: null, checkedAt: new Date().toISOString() },
          status: 'COMPLIANT'
        },
        matchAnalysis: {
          nameScore: result.confidence,
          accountScore: 0.95,
          bankScore: 1.0,
          algorithm: 'fuzzy-match-v2',
          confidence: result.confidence,
          factors: ['name_similarity', 'account_format', 'bank_validation']
        }
      };
    },
    
    // Web-only query: Advanced search with filters
    searchPayees: async (_: any, { query, filters, pagination, sorting }: any) => {
      // In real app, complex search with filters
      return {
        payees: [],
        total: 0,
        page: pagination?.page || 1,
        pageSize: pagination?.pageSize || 20,
        hasMore: false
      };
    },
    
    // Web-only query: Validation history
    getValidationHistory: async (_: any, { payeeId, accountNumber, limit = 50 }: any) => {
      return [];
    },
    
    // Web-only query: Compliance report
    getComplianceReport: async (_: any, { payeeId }: any) => {
      return {
        payeeId,
        overallStatus: 'COMPLIANT',
        sanctions: { passed: true, lists: ['OFAC'], checkedAt: new Date().toISOString() },
        aml: { passed: true, riskLevel: 'LOW', checkedAt: new Date().toISOString() },
        pep: { isPEP: false, category: null, checkedAt: new Date().toISOString() },
        lastCheckedAt: new Date().toISOString(),
        nextCheckDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };
    }
  },
  
  Mutation: {
    // Web-only mutation: Moderate payee
    moderatePayee: async (_: any, { payeeId, action, reason }: any) => {
      return {
        success: true,
        payeeId,
        newStatus: action,
        moderatedBy: webContext.userId,
        moderatedAt: new Date().toISOString()
      };
    },
    
    // Web-only mutation: Update tags
    updatePayeeTags: async (_: any, { payeeId, tags }: any) => {
      return {
        id: payeeId,
        name: 'Example Payee',
        accountNumber: '123456789',
        bankCode: '001',
        accountType: 'CHECKING',
        tags
      };
    }
  },
  
  // Extend Payee type with web-specific fields
  Payee: {
    auditTrail: () => [],
    riskScore: () => 15.5,
    kycStatus: () => 'APPROVED',
    tags: () => ['trusted', 'verified'],
    createdBy: () => 'system',
    createdAt: () => new Date().toISOString(),
    lastModifiedBy: () => null,
    lastModifiedAt: () => null
  }
};

async function start() {
  const app = express();

  // Use complete web schema (base + web extensions)
  const schema = makeExecutableSchema({ 
    typeDefs: completeWebSchema, // Web-specific schema
    resolvers: webResolvers as any 
  });

  const server = new ApolloServer({ schema });
  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  app.listen(4002, () => {
    console.log('🚀 Web BFF ready at http://localhost:4002/graphql');
    console.log(`   User: ${webContext.userId}`);
    console.log(`   Session: ${webContext.sessionId}`);
    console.log(`   IP: ${webContext.ipAddress}`);
  });
}

start().catch(e => console.error(e));
