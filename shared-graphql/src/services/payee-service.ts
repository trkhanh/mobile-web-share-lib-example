import {
  PayeeServiceDependencies,
  ValidatePayeeInput,
  ValidatePayeeResult
} from '../types/payee';
import { validateAccountNumberFormat, validatePayeeName } from '../helpers/payee-helpers';

export class PayeeService {
  constructor(private dependencies: PayeeServiceDependencies) {}

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

      const registeredName = await this.dependencies.dataSource.fetchRegisteredName(
        input.accountNumber,
        input.bankCode
      );

      const validationResult = validatePayeeName(input.accountName, registeredName);

      this.dependencies.logger?.info('Payee validation completed', {
        accountNumber: input.accountNumber,
        result: validationResult
      });

      return validationResult;
    } catch (error) {
      this.dependencies.logger?.error('Payee validation failed', error);
      throw error;
    }
  }

  async getPayee(id: string) {
    return { id, name: 'John Doe', accountNumber: '00000000', bankCode: '000' };
  }
}

export const createPayeeService = (dependencies: PayeeServiceDependencies): PayeeService => {
  return new PayeeService(dependencies);
};
