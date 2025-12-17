/**
 * Mobile BFF - Custom Schema Extensions (OOP)
 * 
 * Demonstrates:
 * - Schema Extension Pattern (OOP principle: Open/Closed)
 * - Mobile-specific fields and optimizations
 * - Bandwidth-conscious design
 * 
 * SOLID:
 * - Open/Closed: Extends base schema without modifying it
 * - Single Responsibility: Mobile-specific concerns only
 */

import { payeeTypeDefs as basePayeeTypeDefs } from '../../shared-graphql/src/graphql/payee-schema';

// ============================================================================
// MOBILE-SPECIFIC SCHEMA EXTENSIONS
// ============================================================================

/**
 * Mobile extends the base schema with mobile-specific fields:
 * 1. mobileOptimizedPayload - Compressed JSON for bandwidth
 * 2. offlineCapable - Can operation be done offline
 * 3. cacheHint - How long mobile can cache
 * 4. dataUsage - Estimated data consumption
 */
export const mobileSchemaExtensions = `
# Mobile-specific extensions to ValidatePayeeResult
extend type ValidatePayeeResult {
  """
  Optimized payload for mobile bandwidth - compressed JSON string
  Contains only essential data for mobile UI
  """
  mobileOptimizedPayload: String!
  
  """
  Indicates if this operation can be performed offline
  """
  offlineCapable: Boolean!
  
  """
  Cache time-to-live in seconds for mobile clients
  """
  cacheTTL: Int!
  
  """
  Estimated data usage in KB for this response
  """
  estimatedDataUsageKB: Float!
}

# Mobile-specific payee information
extend type Payee {
  """
  Indicates if payee is frequently used (for quick access)
  """
  isFavorite: Boolean!
  
  """
  Last transaction timestamp with this payee
  """
  lastUsedAt: String
  
  """
  Thumbnail image URL optimized for mobile
  """
  thumbnailUrl: String
}

# Mobile-specific query extensions
extend type Query {
  """
  Get recent payees optimized for mobile display
  Limited to top 5 for bandwidth
  """
  getRecentPayeesMobile(limit: Int = 5): [Payee!]!
  
  """
  Quick validate optimized for mobile - returns minimal data
  """
  quickValidatePayee(accountNumber: String!): MobileQuickValidateResult!
}

"""
Minimal validation result for mobile quick checks
Reduces bandwidth by returning only essential fields
"""
type MobileQuickValidateResult {
  isValid: Boolean!
  confidence: Float!
  # No additional fields to minimize payload
}

# Mobile-specific enums
enum MobileNetworkType {
  WIFI
  CELLULAR_5G
  CELLULAR_4G
  CELLULAR_3G
  OFFLINE
}

# Mobile context input
input MobileContextInput {
  deviceId: String!
  platform: String!
  appVersion: String!
  networkType: MobileNetworkType
  batteryLevel: Float
}
`;

/**
 * Complete Mobile Schema = Base + Extensions
 * 
 * OOP Principle: Composition over modification
 * - Keeps base schema intact
 * - Adds mobile-specific concerns through extension
 * - Follows Open/Closed Principle
 */
export const completeMobileSchema = [basePayeeTypeDefs, mobileSchemaExtensions];

/**
 * Example Mobile Schema Usage:
 * 
 * ```graphql
 * query ValidatePayeeForMobile($input: ValidatePayeeInput!) {
 *   validatePayee(input: $input) {
 *     # Base fields (from shared schema)
 *     isValid
 *     confidence
 *     
 *     # Mobile-specific fields (from extension)
 *     mobileOptimizedPayload
 *     offlineCapable
 *     cacheTTL
 *     estimatedDataUsageKB
 *   }
 * }
 * 
 * query QuickCheck($accountNumber: String!) {
 *   # Mobile-only query - not available in Web BFF
 *   quickValidatePayee(accountNumber: $accountNumber) {
 *     isValid
 *     confidence
 *   }
 * }
 * ```
 */
