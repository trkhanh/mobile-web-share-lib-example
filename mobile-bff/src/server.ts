import { ApolloServer } from 'apollo-server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { payeeTypeDefs } from '../../shared-graphql/src/graphql/payee-schema';
import { createServices } from '../../shared-graphql/src/factories/service-factory';
import { makePayeeResolvers } from '../../shared-graphql/src/graphql/payee-resolvers';
import { CompleteMobileGatewayFactory, MobileContext } from './custom-gateway';

// ============================================================================
// MOBILE BFF - OOP Gateway Customization Demo
// ============================================================================

// 1. Create mobile context (normally extracted from request headers)
const mobileContext: MobileContext = {
  deviceId: process.env.DEVICE_ID || 'mobile-device-demo-123',
  platform: (process.env.PLATFORM as 'iOS' | 'Android') || 'iOS',
  appVersion: process.env.APP_VERSION || '2.1.0',
  userId: 'mobile-user-123',
  biometricEnabled: true
};

console.log('\n🚀 Mobile BFF Gateway Customization (OOP):');
console.log('   ✅ Layer 1: MobileHeaderGateway - Device headers');
console.log('   ✅ Layer 2: MobileOptimizedGateway - Response optimization');
console.log('   ✅ Layer 3: MobileErrorHandlingGateway - Mobile-friendly errors');
console.log('   ✅ Layer 4: MobileRetryGateway - Fast retry (2 attempts, 500ms-2s)');
console.log('');

// 2. Create mobile-optimized gateway using factory (OOP Decorator Pattern)
const mobileGateway = CompleteMobileGatewayFactory.create(mobileContext);

// 3. Create shared services with customized gateway (Dependency Injection)
const services = createServices({ paymentGateway: mobileGateway });

// Get base resolvers from shared library
const baseResolvers = makePayeeResolvers(services);

// Mobile BFF adds mobile-specific fields
const mobileResolvers = {
  Query: {
    ...baseResolvers.Query,
    validatePayee: async (_: any, { input }: any, context: any) => {
      const result = await services.payeeService.validatePayee(input);
      return {
        ...result,
        mobileOptimizedPayload: JSON.stringify({ ...result, deviceId: mobileContext.deviceId })
      };
    }
  }
};

const schema = makeExecutableSchema({
  typeDefs: [payeeTypeDefs],
  resolvers: mobileResolvers as any
});

const server = new ApolloServer({ schema });

server.listen({ port: 4001 }).then(({ url }) => {
  console.log(`🚀 Mobile BFF ready at ${url}`);
  console.log(`   Device: ${mobileContext.deviceId}`);
  console.log(`   Platform: ${mobileContext.platform}`);
  console.log(`   Version: ${mobileContext.appVersion}`);
});
