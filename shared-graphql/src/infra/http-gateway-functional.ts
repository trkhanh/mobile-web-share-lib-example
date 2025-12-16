import { IPaymentGateway, AuthorizationResult, CaptureResult, RefundResult } from '../ports/gateway';

/**
 * Functional HTTP gateway factory
 * 
 * Uses closure for configuration (baseUrl)
 * No class needed - just functions with shared context
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
  const fn = (mod && (mod.default ?? mod)) as any;
  _fetch = fn;
  return _fetch as any;
}

export const createHttpPaymentGateway = (baseUrl: string): IPaymentGateway => {
  // Private helper function in closure
  const post = async (path: string, body: any): Promise<any> => {
    const fetchFn = await getFetch();
    const res = await fetchFn(`${baseUrl}${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  };

  return {
    authorize: async (amount: number, currency: string, from: string, to: string): Promise<AuthorizationResult> => {
      try {
        const result = await post('/api/payments/authorize', { amount, currency, from, to });
        return {
          success: result.status === 'AUTHORIZED',
          providerRef: result.providerRef,
          error: result.error
        };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },

    capture: async (providerRef: string): Promise<CaptureResult> => {
      try {
        const result = await post('/api/payments/capture', { providerRef });
        return { success: result.status === 'CAPTURED' };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },

    refund: async (providerRef: string, amount: number): Promise<RefundResult> => {
      try {
        const result = await post('/api/payments/refund', { providerRef, amount });
        return { success: result.status === 'REFUNDED' };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  };
};
