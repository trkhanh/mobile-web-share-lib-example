/**
 * Web BFF - Custom GraphQL Schema Extensions
 * 
 * This shows how web BFF extends shared GraphQL with admin and analytics features
 */

import { 
  payeeTypeDefs, 
  paymentTypeDefs,
  makePayeeResolvers,
  makePaymentResolvers,
  createServices 
} from '../../shared-graphql/src';

// ============================================================================
// APPROACH 1: Add Admin Features to Shared Schema
// ============================================================================

export const webAdminExtensions = `
  # Admin analytics types
  type PaymentStats {
    totalAmount: Float!
    count: Int!
    avgAmount: Float!
    successRate: Float!
    failureRate: Float!
    topPayees: [TopPayee!]!
  }

  type TopPayee {
    accountNumber: String!
    accountName: String!
    totalAmount: Float!
    transactionCount: Int!
  }

  # Audit logging
  type AuditLog {
    id: ID!
    timestamp: String!
    userId: String!
    action: String!
    details: String
    ipAddress: String
    userAgent: String
  }

  # System health
  type SystemHealth {
    status: String!
    uptime: Int!
    activeUsers: Int!
    queueDepth: Int!
    errorRate: Float!
  }

  # Extend Query with admin operations
  extend type Query {
    # Analytics
    getPaymentStats(fromDate: String!, toDate: String!): PaymentStats!
    getPayeeStats(accountNumber: String!): TopPayee
    
    # Audit logs
    getAuditLogs(userId: String, limit: Int, offset: Int): [AuditLog!]!
    
    # Batch operations
    validatePayeeBatch(inputs: [ValidatePayeeInput!]!): [ValidatePayeeResult!]!
    
    # System monitoring
    getSystemHealth: SystemHealth!
  }

  # Admin mutations
  extend type Mutation {
    # Reconciliation
    reconcilePayments(date: String!): ReconcileResult!
    
    # Bulk operations
    bulkCreatePayments(payments: [CreatePaymentInput!]!): BulkPaymentResult!
  }

  type ReconcileResult {
    success: Boolean!
    reconciledCount: Int!
    discrepancies: [String!]!
  }

  type BulkPaymentResult {
    successCount: Int!
    failureCount: Int!
    results: [PaymentResult!]!
  }
`;

// ============================================================================
// APPROACH 2: Add Rich UI Features
// ============================================================================

export const webUIExtensions = `
  # Pagination
  type PaymentConnection {
    edges: [PaymentEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type PaymentEdge {
    node: Payment!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  # Filtering
  input PaymentFilter {
    fromDate: String
    toDate: String
    minAmount: Float
    maxAmount: Float
    status: [String!]
    accountNumber: String
  }

  # Extend existing Payment type
  extend type Payment {
    # Rich metadata for web UI
    createdBy: User
    approvedBy: User
    history: [PaymentHistoryEntry!]!
    attachments: [Attachment!]!
  }

  type User {
    id: ID!
    name: String!
    email: String!
    role: String!
  }

  type PaymentHistoryEntry {
    timestamp: String!
    action: String!
    user: User!
    notes: String
  }

  type Attachment {
    id: ID!
    filename: String!
    url: String!
    uploadedAt: String!
  }

  extend type Query {
    # Paginated queries for web tables
    paymentsConnection(
      first: Int
      after: String
      filter: PaymentFilter
    ): PaymentConnection!
    
    # Search with autocomplete
    searchPayees(query: String!, limit: Int): [Payee!]!
  }
`;

// ============================================================================
// APPROACH 3: Complete Custom Schema for Admin Dashboard
// ============================================================================

export const webDashboardSchema = `
  """
  Dashboard-specific types optimized for admin web UI
  """
  type DashboardStats {
    today: DailyStats!
    thisWeek: WeeklyStats!
    thisMonth: MonthlyStats!
  }

  type DailyStats {
    totalPayments: Int!
    totalAmount: Float!
    successRate: Float!
    activeUsers: Int!
  }

  type WeeklyStats {
    totalPayments: Int!
    totalAmount: Float!
    trendPercentage: Float!  # vs last week
  }

  type MonthlyStats {
    totalPayments: Int!
    totalAmount: Float!
    projectedEndOfMonth: Float!
  }

  type RecentActivity {
    id: ID!
    type: String!  # PAYMENT, VALIDATION, LOGIN
    description: String!
    timestamp: String!
    severity: String!  # INFO, WARNING, ERROR
  }

  type Query {
    # Dashboard-specific queries
    getDashboard: DashboardStats!
    getRecentActivity(limit: Int = 20): [RecentActivity!]!
    
    # Still can use shared services via custom resolvers
    validatePayeeForAdmin(input: ValidatePayeeInput!): ValidatePayeeResult!
  }

  # Reuse shared input types
  input ValidatePayeeInput {
    accountNumber: String!
    accountName: String!
    bankCode: String!
  }

  type ValidatePayeeResult {
    isValid: Boolean!
    confidence: Float!
    suggestedName: String
    warnings: [String!]!
  }
`;

// ============================================================================
// Resolvers for Extended Schema (Approach 1 & 2)
// ============================================================================

export function createWebExtendedResolvers() {
  const services = createServices();
  const basePayeeResolvers = makePayeeResolvers(services);
  const basePaymentResolvers = makePaymentResolvers(services);

  return {
    Query: {
      // Include all shared queries
      ...basePayeeResolvers.Query,
      ...basePaymentResolvers.Query,

      // Admin analytics
      getPaymentStats: async (_: any, { fromDate, toDate }: { fromDate: string; toDate: string }) => {
        // In real app, aggregate from database
        return {
          totalAmount: 125000.50,
          count: 450,
          avgAmount: 277.78,
          successRate: 0.96,
          failureRate: 0.04,
          topPayees: [
            {
              accountNumber: '123456789',
              accountName: 'ABC Corp',
              totalAmount: 50000.00,
              transactionCount: 120
            }
          ]
        };
      },

      getPayeeStats: async (_: any, { accountNumber }: { accountNumber: string }) => {
        // Get stats for specific payee
        return {
          accountNumber,
          accountName: 'John Doe',
          totalAmount: 15000.00,
          transactionCount: 45
        };
      },

      getAuditLogs: async (_: any, { userId, limit = 100, offset = 0 }: any) => {
        // Fetch from audit log database
        return [
          {
            id: 'audit-001',
            timestamp: new Date().toISOString(),
            userId: userId || 'user-123',
            action: 'CREATE_PAYMENT',
            details: 'Payment of $500 created',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0...'
          }
        ];
      },

      validatePayeeBatch: async (_: any, { inputs }: { inputs: any[] }) => {
        // Batch validation using shared service
        return await Promise.all(
          inputs.map(input => services.payeeService.validatePayee(input))
        );
      },

      getSystemHealth: async () => {
        return {
          status: 'HEALTHY',
          uptime: 86400, // 24 hours in seconds
          activeUsers: 150,
          queueDepth: 5,
          errorRate: 0.02
        };
      },

      // Pagination support
      paymentsConnection: async (_: any, { first = 10, after, filter }: any) => {
        // In real app, implement proper cursor-based pagination
        const mockPayments = [
          {
            id: 'pay-001',
            amount: 100,
            currency: 'USD',
            status: 'completed',
            createdAt: new Date().toISOString()
          }
        ];

        return {
          edges: mockPayments.map((payment, idx) => ({
            node: payment,
            cursor: Buffer.from(`cursor-${idx}`).toString('base64')
          })),
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: Buffer.from('cursor-0').toString('base64'),
            endCursor: Buffer.from('cursor-0').toString('base64')
          },
          totalCount: mockPayments.length
        };
      },

      searchPayees: async (_: any, { query, limit = 10 }: { query: string; limit?: number }) => {
        // Implement autocomplete search
        // In real app, use Elasticsearch or similar
        return [
          {
            id: 'payee-001',
            accountNumber: '123456789',
            accountName: query,
            bankCode: '001'
          }
        ];
      }
    },

    Mutation: {
      // Include all shared mutations
      ...basePaymentResolvers.Mutation,

      // Admin operations
      reconcilePayments: async (_: any, { date }: { date: string }, ctx: any) => {
        // Check admin permissions
        if (ctx.userRole !== 'ADMIN') {
          throw new Error('Unauthorized: Admin access required');
        }

        // Perform reconciliation
        // In real app, compare against bank statements
        return {
          success: true,
          reconciledCount: 450,
          discrepancies: []
        };
      },

      bulkCreatePayments: async (_: any, { payments }: { payments: any[] }, ctx: any) => {
        // Check admin permissions
        if (ctx.userRole !== 'ADMIN') {
          throw new Error('Unauthorized: Admin access required');
        }

        // Process batch using shared service
        const results = await Promise.all(
          payments.map(payment => 
            services.paymentService.createPayment(payment)
              .catch(err => ({ success: false, reason: err.message }))
          )
        );

        return {
          successCount: results.filter(r => r.success).length,
          failureCount: results.filter(r => !r.success).length,
          results
        };
      }
    },

    // Field resolvers for extended Payment type
    Payment: {
      createdBy: async (parent: any) => {
        // Resolve user who created the payment
        return {
          id: 'user-123',
          name: 'John Admin',
          email: 'john@example.com',
          role: 'ADMIN'
        };
      },

      approvedBy: async (parent: any) => {
        // Resolve approver if applicable
        if (parent.status === 'approved') {
          return {
            id: 'user-456',
            name: 'Jane Manager',
            email: 'jane@example.com',
            role: 'MANAGER'
          };
        }
        return null;
      },

      history: async (parent: any) => {
        // Get payment history
        return [
          {
            timestamp: parent.createdAt,
            action: 'CREATED',
            user: {
              id: 'user-123',
              name: 'John Admin',
              email: 'john@example.com',
              role: 'ADMIN'
            },
            notes: 'Payment created'
          }
        ];
      },

      attachments: async (parent: any) => {
        // Get attachments if any
        return [];
      }
    }
  };
}

// ============================================================================
// Resolvers for Dashboard Schema (Approach 3)
// ============================================================================

export function createWebDashboardResolvers() {
  const services = createServices();

  return {
    Query: {
      getDashboard: async () => {
        // Aggregate dashboard stats
        return {
          today: {
            totalPayments: 45,
            totalAmount: 12500.00,
            successRate: 0.96,
            activeUsers: 28
          },
          thisWeek: {
            totalPayments: 320,
            totalAmount: 89000.00,
            trendPercentage: 8.5 // Up 8.5% vs last week
          },
          thisMonth: {
            totalPayments: 1250,
            totalAmount: 345000.00,
            projectedEndOfMonth: 450000.00
          }
        };
      },

      getRecentActivity: async (_: any, { limit = 20 }: { limit?: number }) => {
        // Get recent activity from audit logs
        return [
          {
            id: 'activity-001',
            type: 'PAYMENT',
            description: 'Payment of $500 completed',
            timestamp: new Date().toISOString(),
            severity: 'INFO'
          },
          {
            id: 'activity-002',
            type: 'VALIDATION',
            description: 'Payee validation failed for account 999999',
            timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            severity: 'WARNING'
          }
        ];
      },

      validatePayeeForAdmin: async (_: any, { input }: any) => {
        // Use shared service for validation
        return await services.payeeService.validatePayee(input);
      }
    }
  };
}
