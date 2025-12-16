import { IPayeeDataSource } from '../ports/payee-data-source';

/**
 * Functional HTTP payee data source factory
 * 
 * Uses closure for baseUrl configuration
 * No class instance needed
 */

// Shared fetch utility (same pattern as http-gateway)
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

export const createHttpPayeeDataSource = (baseUrl: string): IPayeeDataSource => {
  return {
    fetchRegisteredName: async (accountNumber: string, bankCode: string): Promise<string> => {
      const fetchFn = await getFetch();
      const res = await fetchFn(`${baseUrl}/api/payee-registry/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber, bankCode })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      return data.registeredName;
    }
  };
};
