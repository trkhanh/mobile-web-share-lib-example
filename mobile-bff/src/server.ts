import { ApolloServer } from 'apollo-server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { payeeTypeDefs } from '../../shared-graphql/src/graphql/payee-schema';
import { paymentTypeDefs } from '../../shared-graphql/src/graphql/payment-schema';
import { createServices } from '../../shared-graphql/src/factories/service-factory';
import { makePayeeResolvers } from '../../shared-graphql/src/graphql/payee-resolvers';
import { makePaymentResolvers } from '../../shared-graphql/src/graphql/payment-resolvers';
import { createPayeeService } from '../../shared-graphql/src/services/payee-service-functional';
import { createPaymentService } from '../../shared-graphql/src/services/payment-service-functional';
import { validatePayee } from '../../shared-graphql/src/core/payee-validation';
import { ILogger } from '../../shared-graphql/src/ports/logger';
import { createCompleteMobileGateway, MobileContext } from './custom-gateway';

/**
 * MOBILE BFF - Extension Scenarios with Gateway Customization
 * 
 * Shows how consumers can extend shared library in different ways:
 * 1. Custom logger with mobile-specific tracking
 * 2. Wrapping shared services with mobile-specific logic
 * 3. Extending GraphQL resolvers with mobile fields
 * 4. Adding mobile-only mutations
 * 5. Using core functions directly for custom flows
 * 6. **NEW** Custom gateway with mobile headers, error handling, and retry logic
 */

// Scenario 1: Custom logger with mobile analytics
const mobileLogger: ILogger = {
  info: (message: string, meta?: any) => {
    console.log(`[MOBILE] [INFO]`, message, meta ?? '');
    // Could send to mobile analytics service
    // sendToAnalytics('info', message, meta);
  },
  warn: (message: string, meta?: any) => {
    console.warn(`[MOBILE] [WARN]`, message, meta ?? '');
  },
  error: (message: string, meta?: any) => {
    console.error(`[MOBILE] [ERROR]`, message, meta ?? '');
    // Could send to crash reporting service
    // sendToCrashlytics(message, meta);
  }
};

// Scenario 6: Mobile Gateway with Custom Headers, Error Handling, and Retry Logic
const createMobileGatewayForContext = (context: MobileContext) => {
  console.log(`\n🚀 [MOBILE BFF] Creating custom gateway for ${context.platform} device ${context.deviceId}`);
  console.log(`   App Version: ${context.appVersion}`);
  console.log(`   Biometric: ${context.biometricEnabled ? 'Enabled' : 'Disabled'}`);
  console.log(`   Features: Mobile headers ✅ | Error mapping ✅ | Fast retry ✅ | Response optimization ✅\n`);
  
  return createCompleteMobileGateway(context);
};

// Scenario 2: Custom data source with mobile-specific caching
const createMobileCachedDataSource = (baseDataSource: any) => ({
  fetchRegisteredName: async (accountNumber: string, bankCode: string) => {
    // Mobile-specific: check device cache first
    const cached = await checkDeviceCache(accountNumber, bankCode);
    if (cached) return cached;
    
    const result = await baseDataSource.fetchRegisteredName(accountNumber, bankCode);
    await saveToDeviceCache(accountNumber, bankCode, result);
    return result;
  }
});

// Mock device cache functions
async function checkDeviceCache(acc: string, bank: string) {
  // In real app: use AsyncStorage, SQLite, etc.
  return null;
}

async function saveToDeviceCache(acc: string, bank: string, name: string) {
  // In real app: persist to device storage
}

// Create shared services with mobile-specific overrides
const baseServices = createServices({
  logger: mobileLogger
});

// Scenario 3: Wrap shared service with mobile-specific enhancements
const mobilePayeeService = {
  ...baseServices.payeeService,
  
  // Add mobile-specific method
  validatePayeeWithDeviceContext: async (input: any, deviceInfo: any) => {
    const result = await baseServices.payeeService.validatePayee(input);
    return {
      ...result,
      deviceId: deviceInfo.deviceId,
      platform: deviceInfo.platform,
      appVersion: deviceInfo.appVersion,
      // Mobile-specific: add biometric validation flag
      biometricRequired: result.confidence < 0.9
    };
  },
  
  // Override existing method with mobile optimization
  validateBatch: async (inputs: any[]) => {
    // Mobile-specific: limit batch size for network efficiency
    const mobileOptimizedInputs = inputs.slice(0, 10);
    return await baseServices.payeeService.validateBatch(mobileOptimizedInputs);
  }
};

// Scenario 4: Use core functions directly for custom mobile flow
async function mobileQuickValidation(accountNumber: string, bankCode: string, inputName: string, registeredName: string) {
  // Mobile app might do lightweight validation first before calling service
  // Use pure functions from core/ directly
  const result = validatePayee(accountNumber, bankCode, inputName, registeredName);
  
  if (!result.accountValid) {
    return {
      quickCheck: 'FAILED',
      reason: 'Invalid account format',
      shouldCallService: false
    };
  }
  
  return {
    quickCheck: 'PASSED',
    shouldCallService: true,
    data: result
  };
}

// Get base resolvers from shared library
const basePayeeResolvers = makePayeeResolvers(baseServices);
const basePaymentResolvers = makePaymentResolvers(baseServices);

// Scenario 5: Extend resolvers with mobile-specific fields and mutations
const mobileResolvers = {
  Query: {
    ...basePayeeResolvers.Query,
    ...basePaymentResolvers.Query,
    
    // Override with mobile-specific response
    validatePayee: async (_: any, { input }: any, context: any) => {
      const deviceInfo = context.deviceInfo || {};
      const result = await mobilePayeeService.validatePayeeWithDeviceContext(input, deviceInfo);
      return result;
    },
    
    // Mobile-only: quick validation without downstream call
    quickValidatePayee: async (_: any, { accountNumber, bankCode, inputName, registeredName }: any) => {
      return await mobileQuickValidation(accountNumber, bankCode, inputName, registeredName);
    }
  },
  
  Mutation: {
    ...basePaymentResolvers.Mutation,
    
    // Mobile-only: create payment with biometric verification
    createPaymentWithBiometric: async (_: any, { input, biometricToken }: any) => {
      // Verify biometric first
      if (!biometricToken || biometricToken !== 'valid-biometric') {
        return { success: false, error: 'BIOMETRIC_FAILED' };
      }
      
      // Use shared payment service
      return await baseServices.paymentService.createPayment(input);
    }
  }
};

// Mobile-specific GraphQL extensions
const mobileTypeDefs = `
extend type ValidatePayeeResult {
  deviceId: String
  platform: String
  appVersion: String
  biometricRequired: Boolean
}

type QuickValidationResult {
  quickCheck: String!
  reason: String
  shouldCallService: Boolean!
  data: ValidatePayeeResult
}

extend type Query {
  quickValidatePayee(accountNumber: String!, bankCode: String!, inputName: String!, registeredName: String!): QuickValidationResult!
}

extend type Mutation {
  createPaymentWithBiometric(input: CreatePaymentInput!, biometricToken: String!): CreatePaymentResult!
}
`;

const schema = makeExecutableSchema({
  typeDefs: [payeeTypeDefs, paymentTypeDefs, mobileTypeDefs],
  resolvers: mobileResolvers as any
});

// Demo: Create services with mobile-customized gateway
const mobileContext: MobileContext = {
  deviceId: 'demo-device-123',
  platform: 'iOS',
  appVersion: '2.1.0',
  userId: 'demo-user',
  biometricEnabled: true
};

const mobileGateway = createMobileGatewayForContext(mobileContext);
const mobileServices = createServices({
  paymentGateway: mobileGateway,
  logger: mobileLogger
});

const server = new ApolloServer({
  schema,
  context: ({ req }: any) => ({
    // Extract device info from headers (in production)
    deviceInfo: {
      deviceId: req.headers['x-device-id'] || 'demo-device-123',
      platform: req.headers['x-platform'] || 'iOS',
      appVersion: req.headers['x-app-version'] || '2.1.0',
      biometricEnabled: req.headers['x-biometric-enabled'] === 'true'
    },
    // Provide services with customized gateway
    services: mobileServices
  })
});

server.listen({ port: 4001 }).then(({ url }) => {
  console.log(`🚀 Mobile BFF ready at ${url}`);
  console.log(`
  📱 Mobile-specific extensions:
  ✅ Custom logger with analytics
  ✅ Device-based caching
  ✅ Biometric payment flow
  ✅ Quick validation (offline-first)
  ✅ Device context in all responses
  
  🔧 Gateway Customizations:
  ✅ Mobile-specific headers (device ID, platform, app version)
  ✅ Mobile-friendly error codes (NETWORK_ERROR, TIMEOUT, etc.)
  ✅ Fast retry logic (500ms-2s, max 2 attempts)
  ✅ Response optimization for bandwidth
  `);
});
