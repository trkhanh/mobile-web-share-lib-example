import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { payeeTypeDefs } from '../../shared-graphql/src/graphql/payee-schema';
import { createServices } from '../../shared-graphql/src/factories/service-factory';
import { makePayeeResolvers } from '../../shared-graphql/src/graphql/payee-resolvers';
import { CompleteWebGatewayFactory, WebContext } from './custom-gateway';

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

const webTypeDefs = `
extend type ValidatePayeeResult {
  validationId: ID!
}
`;

// Web BFF adds web-specific fields
const webResolvers = {
  Query: {
    ...baseResolvers.Query,
    validatePayee: async (_: any, { input }: any, context: any) => {
      const result = await services.payeeService.validatePayee(input);
      return {
        ...result,
        validationId: `val_${Date.now()}`
      };
    }
  }
};

async function start() {
  const app = express();

  const schema = makeExecutableSchema({ typeDefs: [payeeTypeDefs], resolvers: webResolvers as any });

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
