/**
 * Payee data source port
 *
 * SOLID notes:
 * - Interface Segregation: focused interface for fetching registered payee data
 *   from downstream systems (bank registry, KYC provider, etc.).
 * - Dependency Inversion: PayeeService depends on this abstraction, allowing
 *   different data source implementations (HTTP, gRPC, mock) to be injected.
 */
export interface IPayeeDataSource {
  /**
   * Fetch the registered name for a given account from downstream system.
   * @param accountNumber - The account number to look up
   * @param bankCode - The bank code for routing
   * @returns The registered account holder name
   * @throws Error if account not found or downstream unavailable
   */
  fetchRegisteredName(accountNumber: string, bankCode: string): Promise<string>;
}
