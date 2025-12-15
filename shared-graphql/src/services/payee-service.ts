import { ValidatePayeeInput, ValidatePayeeResult } from '../types/payee';
import { validateAccountNumberFormat, validatePayeeName } from '../helpers/payee-helpers';
import { IPayeeDataSource } from '../ports/payee-data-source';
import { ILogger } from '../ports/logger';

/**
 * PayeeService - orchestrates payee validation flows
 *
 * SOLID notes:
 * - Single Responsibility: validates payees by calling downstream data sources
 *   and applying business rules (name similarity, account format).
 * - Dependency Inversion: depends on IPayeeDataSource and ILogger abstractions.
 */
export class PayeeService {
  constructor(
    private dataSource: IPayeeDataSource,
    private logger: ILogger
  ) {}

  async validatePayee(input: ValidatePayeeInput): Promise<ValidatePayeeResult> {
    try {
      const isAccountValid = validateAccountNumberFormat(input.accountNumber, input.bankCode);

      if (!isAccountValid) {
        return {
          isValid: false,
          matchLevel: 'NO_MATCH',
          confidence: 0,
          suggestedName: undefined
        };
      }

      // Call downstream system to fetch registered name
      const registeredName = await this.dataSource.fetchRegisteredName(
        input.accountNumber,
        input.bankCode
      );

      const validationResult = validatePayeeName(input.accountName, registeredName);

      this.logger.info('Payee validation completed', {
        accountNumber: input.accountNumber,
        result: validationResult
      });

      return validationResult;
    } catch (error) {
      this.logger.error('Payee validation failed', error);
      throw error;
    }
  }
}
