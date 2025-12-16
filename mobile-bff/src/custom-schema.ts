/**
 * Mobile BFF - Custom GraphQL Schema Extensions
 * 
 * This shows how mobile BFF extends shared GraphQL schema with mobile-specific needs
 */

import { 
  payeeTypeDefs, 
  paymentTypeDefs,
  makePayeeResolvers,
  makePaymentResolvers,
  createServices 
} from '../../shared-graphql/src';

// ============================================================================
// APPROACH 1: Extend Shared Types with Mobile-Specific Fields
// ============================================================================

export const mobilePayeeExtensions = `
  # Extend shared ValidatePayeeResult with mobile fields
  extend type ValidatePayeeResult {
    # Mobile device info
    deviceId: String
    platform: String!  # iOS, Android
    
    # Mobile-specific validations
    biometricRequired: Boolean!
    offlineCapable: Boolean!
    touchIdEnabled: Boolean
    
    # Mobile optimization
    cacheUntil: String  # ISO timestamp for client caching
  }
`;

export const mobilePaymentExtensions = `
  # Extend shared Payment types with mobile fields
  extend type Payment {
    # Mobile tracking
    appVersion: String!
    deviceModel: String
    
    # Mobile features
    savedForOffline: Boolean!
    pushNotificationSent: Boolean!
  }

  # Mobile-specific input
  input MobilePushPreferences {
    enabled: Boolean!
    sound: Boolean!
    vibrate: Boolean!
  }

  extend type Mutation {
    # Mobile-only mutations
    updatePushPreferences(prefs: MobilePushPreferences!): Boolean!
  }
`;

// ============================================================================
// APPROACH 2: Mobile-Specific Queries
// ============================================================================

export const mobileQueriesExtensions = `
  # Mobile app state
  type AppConfig {
    minVersion: String!
    updateRequired: Boolean!
    features: [String!]!
    endpoints: MobileEndpoints!
  }

  type MobileEndpoints {
    payment: String!
    payee: String!
    biometric: String!
  }

  # Offline sync
  type SyncStatus {
    lastSync: String!
    pendingCount: Int!
    needsSync: Boolean!
  }

  extend type Query {
    # Mobile-specific queries
    getAppConfig: AppConfig!
    getSyncStatus(deviceId: String!): SyncStatus!
    
    # Quick mobile checks (optimized)
    quickValidatePayee(account: String!): Boolean!
  }
`;

// ============================================================================
// APPROACH 3: Completely Custom Mobile Schema (Alternative)
// ============================================================================

export const mobileSimplifiedSchema = `
  """
  Simplified payee type for mobile - only essential fields
  """
  type MobilePayee {
    id: ID!
    name: String!
    account: String!
    isValid: Boolean!
    canPayNow: Boolean!
  }

  """
  Simplified payment for mobile list views
  """
  type MobilePayment {
    id: ID!
    amount: Float!
    to: String!
    status: String!
    when: String!
  }

  """
  Mobile-optimized queries
  """
  type Query {
    # Simple check
    checkPayee(account: String!): MobilePayee!
    
    # Recent payments
    recentPayments(count: Int = 10): [MobilePayment!]!
  }

  """
  Mobile-optimized mutations
  """
  type Mutation {
    # Single simple payment
    sendMoney(to: String!, amount: Float!): MobilePayment!
  }
`;

// ============================================================================
// Resolvers for Extended Schema (Approach 1 & 2)
// ============================================================================

export function createMobileExtendedResolvers(context: {
  deviceId?: string;
  platform?: string;
  appVersion?: string;
}) {
  const services = createServices();
  const basePayeeResolvers = makePayeeResolvers(services);
  const basePaymentResolvers = makePaymentResolvers(services);

  return {
    Query: {
      // Include all shared queries
      ...basePayeeResolvers.Query,
      ...basePaymentResolvers.Query,

      // Wrap validatePayee to add mobile fields
      validatePayee: async (parent: any, args: any) => {
        // Call shared resolver (it takes parent and args)
        const baseResult = await basePayeeResolvers.Query.validatePayee(parent, args);
        
        // Add mobile-specific fields
        return {
          ...baseResult,
          deviceId: context.deviceId,
          platform: context.platform || 'unknown',
          biometricRequired: baseResult.confidence < 0.9, // Require biometric if uncertain
          offlineCapable: true,
          touchIdEnabled: context.platform === 'iOS',
          cacheUntil: new Date(Date.now() + 5 * 60 * 1000).toISOString() // Cache 5 min
        };
      },

      // Mobile-specific queries
      getAppConfig: async () => {
        return {
          minVersion: '2.0.0',
          updateRequired: false,
          features: ['biometric', 'offline-sync', 'push-notifications'],
          endpoints: {
            payment: process.env.MOBILE_PAYMENT_ENDPOINT || 'https://api-mobile.example.com/payments',
            payee: process.env.MOBILE_PAYEE_ENDPOINT || 'https://api-mobile.example.com/payees',
            biometric: process.env.BIOMETRIC_ENDPOINT || 'https://api-mobile.example.com/auth'
          }
        };
      },

      getSyncStatus: async (_: any, { deviceId }: { deviceId: string }) => {
        // In real app, check device sync state from DB
        return {
          lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          pendingCount: 3,
          needsSync: true
        };
      },

      quickValidatePayee: async (_: any, { account }: { account: string }) => {
        // Optimized quick check for mobile
        const result = await services.payeeService.validatePayee({
          accountNumber: account,
          accountName: '',
          bankCode: '001'
        });
        return result.isValid;
      }
    },

    Mutation: {
      // Include all shared mutations
      ...basePaymentResolvers.Mutation,

      // Override createPayment to add mobile tracking
      createPayment: async (parent: any, { input }: any, ctx: any) => {
        // Mobile-specific checks
        if (!ctx.biometricVerified) {
          return {
            success: false,
            reason: 'BIOMETRIC_VERIFICATION_REQUIRED'
          };
        }

        // Call shared service
        const result = await services.paymentService.createPayment(input);

        // Add mobile tracking if successful
        if (result.success) {
          // Track in mobile analytics
          await trackMobilePayment({
            paymentId: result.paymentId,
            deviceId: context.deviceId,
            appVersion: context.appVersion,
            platform: context.platform
          });

          // Send push notification
          await sendPushNotification(ctx.userId, {
            title: 'Payment Sent',
            body: `$${input.amount} sent successfully`
          });
        }

        return result;
      },

      // Mobile-only mutation
      updatePushPreferences: async (_: any, { prefs }: any, ctx: any) => {
        // Update user's push notification preferences
        await updateUserPreferences(ctx.userId, {
          pushEnabled: prefs.enabled,
          sound: prefs.sound,
          vibrate: prefs.vibrate
        });
        return true;
      }
    }
  };
}

// ============================================================================
// Resolvers for Simplified Schema (Approach 3)
// ============================================================================

export function createMobileSimplifiedResolvers() {
  const services = createServices();

  return {
    Query: {
      checkPayee: async (_: any, { account }: { account: string }) => {
        // Use shared service but return simplified format
        const result = await services.payeeService.validatePayee({
          accountNumber: account,
          accountName: '',
          bankCode: '001'
        });

        return {
          id: account,
          name: result.suggestedName || 'Unknown',
          account,
          isValid: result.isValid,
          canPayNow: result.isValid && result.confidence > 0.8
        };
      },

      recentPayments: async (_: any, { count = 10 }: { count?: number }, ctx: any) => {
        // In real app, fetch from DB
        // Mock data for example
        return [
          {
            id: 'pay-001',
            amount: 50.00,
            to: 'John Doe',
            status: 'completed',
            when: new Date().toISOString()
          }
        ];
      }
    },

    Mutation: {
      sendMoney: async (_: any, { to, amount }: { to: string; amount: number }, ctx: any) => {
        // Use shared service
        const result = await services.paymentService.createPayment({
          amount,
          currency: 'USD',
          fromAccount: ctx.userAccount,
          toAccount: to
        });

        if (!result.success) {
          throw new Error(result.reason || 'Payment failed');
        }

        return {
          id: result.paymentId,
          amount,
          to,
          status: 'completed',
          when: new Date().toISOString()
        };
      }
    }
  };
}

// ============================================================================
// Helper Functions (would be implemented properly)
// ============================================================================

async function trackMobilePayment(data: any) {
  // Send to mobile analytics service
  console.log('Mobile payment tracked:', data);
}

async function sendPushNotification(userId: string, notification: any) {
  // Send push notification
  console.log('Push notification sent to', userId, notification);
}

async function updateUserPreferences(userId: string, prefs: any) {
  // Update in database
  console.log('Updated preferences for', userId, prefs);
}
