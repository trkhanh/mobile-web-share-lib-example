/**
 * Web BFF - Custom Schema Extensions (OOP)
 * 
 * Demonstrates:
 * - Schema Extension Pattern (OOP principle: Open/Closed)
 * - Web-specific fields for rich admin interfaces
 * - Detailed audit and compliance information
 * 
 * SOLID:
 * - Open/Closed: Extends base schema without modifying it
 * - Single Responsibility: Web-specific concerns only
 */

import { payeeTypeDefs as basePayeeTypeDefs } from '../../shared-graphql/src/graphql/payee-schema';

// ============================================================================
// WEB-SPECIFIC SCHEMA EXTENSIONS
// ============================================================================

/**
 * Web extends the base schema with web-specific fields:
 * 1. validationId - Unique ID for tracking
 * 2. auditLog - Complete audit trail
 * 3. metadata - Rich metadata for admin dashboards
 * 4. complianceInfo - Regulatory compliance data
 */
export const webSchemaExtensions = `
# Web-specific extensions to ValidatePayeeResult
extend type ValidatePayeeResult {
  """
  Unique validation ID for tracking and audit purposes
  """
  validationId: ID!
  
  """
  Complete audit trail with timestamps
  """
  auditLog: AuditLog!
  
  """
  Rich metadata for admin dashboards
  """
  metadata: ValidationMetadata!
  
  """
  Compliance and regulatory information
  """
  complianceInfo: ComplianceInfo
  
  """
  Detailed match analysis (for debugging)
  """
  matchAnalysis: MatchAnalysis!
}

# Web-specific payee information
extend type Payee {
  """
  Full audit trail of payee changes
  """
  auditTrail: [AuditEntry!]!
  
  """
  Risk assessment score (0-100)
  """
  riskScore: Float
  
  """
  KYC (Know Your Customer) status
  """
  kycStatus: KYCStatus!
  
  """
  Associated tags for categorization
  """
  tags: [String!]!
  
  """
  Creator user ID
  """
  createdBy: String!
  
  """
  Creation timestamp
  """
  createdAt: String!
  
  """
  Last modifier user ID
  """
  lastModifiedBy: String
  
  """
  Last modification timestamp
  """
  lastModifiedAt: String
}

# Audit log structure
type AuditLog {
  validationId: ID!
  userId: String!
  sessionId: String!
  ipAddress: String!
  userAgent: String!
  timestamp: String!
  processingTimeMs: Int!
  downstreamCalls: [DownstreamCall!]!
}

# Audit entry for payee changes
type AuditEntry {
  action: String!
  userId: String!
  timestamp: String!
  changes: String
  ipAddress: String
}

# Validation metadata
type ValidationMetadata {
  requestId: String!
  correlationId: String!
  environment: String!
  version: String!
  timestamp: String!
  region: String
  datacenter: String
}

# Compliance information
type ComplianceInfo {
  sanctions: SanctionsCheck!
  aml: AMLCheck!
  pep: PEPCheck!
  status: ComplianceStatus!
}

# Sanctions check result
type SanctionsCheck {
  passed: Boolean!
  lists: [String!]!
  checkedAt: String!
}

# Anti-Money Laundering check
type AMLCheck {
  passed: Boolean!
  riskLevel: RiskLevel!
  checkedAt: String!
}

# Politically Exposed Person check
type PEPCheck {
  isPEP: Boolean!
  category: String
  checkedAt: String!
}

# Match analysis for debugging
type MatchAnalysis {
  nameScore: Float!
  accountScore: Float!
  bankScore: Float!
  algorithm: String!
  confidence: Float!
  factors: [String!]!
}

# Downstream service call info
type DownstreamCall {
  service: String!
  operation: String!
  durationMs: Int!
  statusCode: Int
  success: Boolean!
}

# Web-specific enums
enum KYCStatus {
  NOT_STARTED
  IN_PROGRESS
  APPROVED
  REJECTED
  EXPIRED
}

enum ComplianceStatus {
  COMPLIANT
  NON_COMPLIANT
  PENDING_REVIEW
  EXEMPT
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

# Web-specific queries
extend type Query {
  """
  Get payees with advanced filtering and pagination (Web admin only)
  """
  searchPayees(
    query: String
    filters: PayeeFilters
    pagination: PaginationInput
    sorting: SortingInput
  ): PayeeSearchResult!
  
  """
  Get validation history for a payee (Web admin only)
  """
  getValidationHistory(
    payeeId: ID
    accountNumber: String
    limit: Int = 50
  ): [ValidationHistoryEntry!]!
  
  """
  Get compliance report for a payee (Web admin only)
  """
  getComplianceReport(payeeId: ID!): ComplianceReport!
}

# Web-specific mutations
extend type Mutation {
  """
  Approve or reject a payee (Web admin only)
  """
  moderatePayee(
    payeeId: ID!
    action: ModerationAction!
    reason: String
  ): ModerationResult!
  
  """
  Update payee tags (Web admin only)
  """
  updatePayeeTags(
    payeeId: ID!
    tags: [String!]!
  ): Payee!
}

# Web-specific input types
input PayeeFilters {
  status: String
  riskLevel: RiskLevel
  kycStatus: KYCStatus
  createdAfter: String
  createdBefore: String
  tags: [String!]
}

input PaginationInput {
  page: Int = 1
  pageSize: Int = 20
}

input SortingInput {
  field: String!
  direction: SortDirection!
}

enum SortDirection {
  ASC
  DESC
}

enum ModerationAction {
  APPROVE
  REJECT
  FLAG_FOR_REVIEW
  ARCHIVE
}

# Web-specific result types
type PayeeSearchResult {
  payees: [Payee!]!
  total: Int!
  page: Int!
  pageSize: Int!
  hasMore: Boolean!
}

type ValidationHistoryEntry {
  validationId: ID!
  timestamp: String!
  isValid: Boolean!
  confidence: Float!
  userId: String!
  ipAddress: String!
}

type ComplianceReport {
  payeeId: ID!
  overallStatus: ComplianceStatus!
  sanctions: SanctionsCheck!
  aml: AMLCheck!
  pep: PEPCheck!
  lastCheckedAt: String!
  nextCheckDue: String
}

type ModerationResult {
  success: Boolean!
  payeeId: ID!
  newStatus: String!
  moderatedBy: String!
  moderatedAt: String!
}
`;

/**
 * Complete Web Schema = Base + Extensions
 * 
 * OOP Principle: Composition over modification
 * - Keeps base schema intact
 * - Adds web-specific concerns through extension
 * - Follows Open/Closed Principle
 */
export const completeWebSchema = [basePayeeTypeDefs, webSchemaExtensions];

/**
 * Example Web Schema Usage:
 * 
 * ```graphql
 * query ValidatePayeeForWeb($input: ValidatePayeeInput!) {
 *   validatePayee(input: $input) {
 *     # Base fields (from shared schema)
 *     isValid
 *     confidence
 *     
 *     # Web-specific fields (from extension)
 *     validationId
 *     auditLog {
 *       userId
 *       sessionId
 *       timestamp
 *       processingTimeMs
 *     }
 *     metadata {
 *       requestId
 *       correlationId
 *       environment
 *     }
 *     complianceInfo {
 *       status
 *       sanctions { passed }
 *       aml { riskLevel }
 *     }
 *     matchAnalysis {
 *       nameScore
 *       confidence
 *       factors
 *     }
 *   }
 * }
 * 
 * query AdminSearch($query: String!, $filters: PayeeFilters) {
 *   # Web-only query - not available in Mobile BFF
 *   searchPayees(query: $query, filters: $filters) {
 *     payees {
 *       id
 *       name
 *       riskScore
 *       kycStatus
 *       tags
 *     }
 *     total
 *     hasMore
 *   }
 * }
 * ```
 */
