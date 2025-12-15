import { IPayeeDataSource } from '../ports/payee-data-source';

/**
 * HttpPayeeDataSource
 *
 * SOLID notes:
 * - Single Responsibility: handles HTTP communication with downstream payee
 *   registry (bank API, KYC provider, etc.).
 * - Dependency Inversion: implements IPayeeDataSource so services depend on
 *   the abstraction, not this concrete HTTP client.
 * - Open/Closed: can extend with retries, circuit breakers, auth without
 *   changing PayeeService.
 */

let _fetch: typeof fetch | null = null;
async function getFetch(): Promise<typeof fetch> {
  if (_fetch) return _fetch as any;
  if (typeof globalThis.fetch === 'function') {
    _fetch = globalThis.fetch as any;
    return _fetch as any;
  }
  const mod = await import('node-fetch');
  const fn = (mod && (mod.default ?? mod)) as any;
  _fetch = fn;
  return _fetch as any;
}

export class HttpPayeeDataSource implements IPayeeDataSource {
  constructor(private baseUrl: string) {}

  async fetchRegisteredName(accountNumber: string, bankCode: string): Promise<string> {
    const fetchFn = await getFetch();
    const res = await fetchFn(`${this.baseUrl}/payees/registered-name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountNumber, bankCode })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: failed to fetch registered name`);
    }

    const json: any = await res.json();
    if (!json.name) {
      throw new Error('ACCOUNT_NOT_FOUND');
    }
    return json.name;
  }
}
