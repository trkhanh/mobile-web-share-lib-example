import { IPaymentGateway, AuthorizationResult, CaptureResult, RefundResult } from '../ports/gateway';

/**
 * HttpPaymentGateway
 *
 * SOLID notes:
 * - Single Responsibility: this class handles HTTP communication with an
 *   external payment provider only. It transforms requests/responses to the
 *   `IPaymentGateway` contract.
 * - Dependency Inversion: implements `IPaymentGateway` so the higher-level
 *   payment service depends on the abstraction and not on this concrete class.
 * - Open/Closed: the class can be extended or replaced (e.g., add headers,
 *   retries, or different serialization) without changing the service logic.
 */

// Use global fetch when available (Node 18+), otherwise dynamically import `node-fetch` at runtime.
let _fetch: typeof fetch | null = null;
async function getFetch(): Promise<typeof fetch> {
  if (_fetch) return _fetch as any;
  if (typeof globalThis.fetch === 'function') {
    _fetch = globalThis.fetch as any;
    return _fetch as any;
  }
  // dynamic import of node-fetch (ESM) — use default export when provided
  const mod = await import('node-fetch');
  // node-fetch v3+ exports default as function
  const fn = (mod && (mod.default ?? mod)) as any;
  _fetch = fn;
  return _fetch as any;
}

export class HttpPaymentGateway implements IPaymentGateway {
  constructor(private baseUrl: string) {}

  private async post(path: string, body: any): Promise<any> {
    const fetchFn = await getFetch();
    const res = await fetchFn(`${this.baseUrl}${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    });
    const json: any = await res.json();
    return json;
  }

  async authorize(amount: number, currency: string, from: string, to: string): Promise<AuthorizationResult> {
    const json = await this.post('/payments/authorize', { amount, currency, from, to });
    return { success: !!json.success, providerRef: json.providerRef, error: json.error };
  }

  async capture(providerRef: string): Promise<CaptureResult> {
    const json = await this.post('/payments/capture', { providerRef });
    return { success: !!json.success, error: json.error };
  }

  async refund(providerRef: string, amount: number): Promise<RefundResult> {
    const json = await this.post('/payments/refund', { providerRef, amount });
    return { success: !!json.success, error: json.error };
  }
}
