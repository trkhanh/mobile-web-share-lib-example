import { ApolloServer } from 'apollo-server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { createServices } from '../../shared-graphql/src/factories/service-factory';
import { makePayeeResolvers } from '../../shared-graphql/src/graphql/payee-resolvers';
import { CompleteMobileGatewayFactory, MobileContext } from './custom-gateway';
import { completeMobileSchema } from './custom-schema';

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

// ============================================================================
// MOBILE-SPECIFIC RESOLVERS (OOP: Open/Closed Principle)
// Extends base resolvers without modifying them
// ============================================================================

const mobileResolvers = {
  Query: {
    ...baseResolvers.Query,
    
    // Override base validatePayee to add mobile-specific fields
    validatePayee: async (_: any, { input }: any, context: any) => {
      const result = await services.payeeService.validatePayee(input);
      
      // Add mobile-specific fields (from custom schema extensions)
      return {
        ...result,
        mobileOptimizedPayload: JSON.stringify({ 
          valid: result.isValid, 
          conf: result.confidence,
          device: mobileContext.deviceId 
        }),
        offlineCapable: result.confidence > 0.9, // High confidence = can cache
        cacheTTL: result.confidence > 0.9 ? 3600 : 300, // 1 hour or 5 min
        estimatedDataUsageKB: 0.5 // Optimized payload
      };
    },
    
    // Mobile-only query: Quick validate with minimal data
    quickValidatePayee: async (_: any, { accountNumber }: any) => {
      const result = await services.payeeService.validatePayee({
        accountNumber,
        accountName: '', // Quick check doesn't validate name
        bankCode: '000'
      });
      
      return {
        isValid: result.isValid,
        confidence: result.confidence
        // No other fields to minimize bandwidth
      };
    },
    
    // Mobile-only query: Recent payees (limited for mobile)
    getRecentPayeesMobile: async (_: any, { limit = 5 }: any) => {
      // In real app, fetch from payee service
      return [];
    }
  },
  
  // Extend Payee type with mobile-specific fields
  Payee: {
    isFavorite: () => false,
    lastUsedAt: () => null,
    thumbnailUrl: (payee: any) => `https://cdn.example.com/thumbs/${payee.id}.jpg`
  }
};

// Use complete mobile schema (base + mobile extensions)
const schema = makeExecutableSchema({
  typeDefs: completeMobileSchema, // Mobile-specific schema
  resolvers: mobileResolvers as any
});

const server = new ApolloServer({ schema });

server.listen({ port: 4001 }).then(({ url }) => {
  console.log(`🚀 Mobile BFF ready at ${url}`);
  console.log(`   Device: ${mobileContext.deviceId}`);
  console.log(`   Platform: ${mobileContext.platform}`);
  console.log(`   Version: ${mobileContext.appVersion}`);
});
