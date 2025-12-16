import { IPaymentGateway, AuthorizationResult, CaptureResult, RefundResult } from '../ports/gateway';

/**
 * Functional mock gateway factory
 * 
 * Stateless mock implementation as pure functions
 * No class ceremony needed
 */
export const createMockGateway = (): IPaymentGateway => ({
  authorize: async (amount: number, currency: string, from: string, to: string): Promise<AuthorizationResult> => {
    // Simple mock: decline amounts <=0, otherwise return fake providerRef
    if (amount <= 0) return { success: false, error: 'INVALID_AMOUNT' };
    const providerRef = `mock-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return { success: true, providerRef };
  },

  capture: async (providerRef: string): Promise<CaptureResult> => {
    return { success: true };
  },

  refund: async (providerRef: string, amount: number): Promise<RefundResult> => {
    if (!providerRef) return { success: false, error: 'NO_PROVIDER_REF' };
    return { success: true };
  }
});
