import { IPayeeDataSource } from '../ports/payee-data-source';

/**
 * Functional mock payee data source factory
 * 
 * Uses closure for test data instead of class properties
 */
export const createMockPayeeDataSource = (): IPayeeDataSource => {
  // Test data in closure (could be passed as parameter for customization)
  const registryMap = new Map<string, string>([
    ['1234567890', 'John Doe'],
    ['0987654321', 'Jane Smith'],
    ['1111111111', 'Acme Corporation']
  ]);

  return {
    fetchRegisteredName: async (accountNumber: string, bankCode: string): Promise<string> => {
      // Simple mock: return registered name or throw if not found
      const registered = registryMap.get(accountNumber);
      if (!registered) {
        throw new Error('ACCOUNT_NOT_FOUND');
      }
      return registered;
    }
  };
};
