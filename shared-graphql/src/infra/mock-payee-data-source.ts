import { IPayeeDataSource } from '../ports/payee-data-source';

/**
 * MockPayeeDataSource
 *
 * SOLID notes:
 * - Single Responsibility: provides fake registered names for local testing.
 * - Dependency Inversion: implements IPayeeDataSource so it can replace real
 *   data sources during tests.
 */
export class MockPayeeDataSource implements IPayeeDataSource {
  private registry: Map<string, string> = new Map([
    ['12345678', 'Acme Corporation'],
    ['11111111', 'John Doe'],
    ['99999999', 'Jane Smith']
  ]);

  async fetchRegisteredName(accountNumber: string, bankCode: string): Promise<string> {
    const name = this.registry.get(accountNumber);
    if (!name) {
      throw new Error(`ACCOUNT_NOT_FOUND: ${accountNumber}`);
    }
    return name;
  }
}
