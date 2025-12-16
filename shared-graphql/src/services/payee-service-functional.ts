/**
 * Functional payee service
 * 
 * Uses functional factory pattern instead of classes:
 * - Returns object with methods (closure pattern)
 * - Dependencies injected via factory function
 * - Core logic uses pure functions from core/payee-validation
 */

import { ValidatePayeeInput, ValidatePayeeResult } from '../types/payee';
import { validatePayee } from '../core/payee-validation';
import { IPayeeDataSource } from '../ports/payee-data-source';
import { ILogger } from '../ports/logger';

export type PayeeServiceDeps = {
  dataSource: IPayeeDataSource;
  logger: ILogger;
  cache?: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any, ttl?: number) => Promise<void>;
  };
};

/**
 * Create a payee service using functional factory pattern
 * Returns an object with methods, avoiding class ceremony
 */
export const createPayeeService = (deps: PayeeServiceDeps) => {
  const { dataSource, logger, cache } = deps;

  /**
   * Validate payee with caching support
   * Async wrapper around pure validation logic
   */
  const validatePayeeRequest = async (input: ValidatePayeeInput): Promise<ValidatePayeeResult> => {
    try {
      // Check cache first
      const cacheKey = `validate_${input.accountNumber}_${input.bankCode}`;
      if (cache) {
        const cached = await cache.get(cacheKey);
        if (cached) {
          logger.info('Cache hit for payee validation', { accountNumber: input.accountNumber });
          return cached;
        }
      }

      // Fetch registered name from downstream system
      const registeredName = await dataSource.fetchRegisteredName(
        input.accountNumber,
        input.bankCode
      );

      // Use pure function for business logic
      const result = validatePayee(
        input.accountNumber,
        input.bankCode,
        input.accountName,
        registeredName
      );

      // Cache result
      if (cache) {
        await cache.set(cacheKey, result, 300); // 5 minutes TTL
      }

      logger.info('Payee validation completed', {
        accountNumber: input.accountNumber,
        result
      });

      return result;
    } catch (error) {
      logger.error('Payee validation failed', error);
      throw error;
    }
  };

  /**
   * Batch validation using functional patterns
   */
  const validateBatch = async (inputs: ValidatePayeeInput[]): Promise<ValidatePayeeResult[]> => {
    logger.info('Starting batch payee validation', { count: inputs.length });
    
    // Process in parallel using functional map
    const results = await Promise.all(
      inputs.map(input => validatePayeeRequest(input))
    );
    
    logger.info('Batch validation completed', { 
      total: results.length,
      valid: results.filter(r => r.isValid).length
    });
    
    return results;
  };

  // Return service interface
  return {
    validatePayee: validatePayeeRequest,
    validateBatch
  };
};

// Type for the service returned by factory
export type PayeeService = ReturnType<typeof createPayeeService>;
