import { IPaymentGateway, AuthorizationResult, CaptureResult, RefundResult } from '../ports/gateway';

export class MockGateway implements IPaymentGateway {
  async authorize(amount: number, currency: string, from: string, to: string): Promise<AuthorizationResult> {
    // Simple mock: decline amounts <=0, otherwise return fake providerRef
    if (amount <= 0) return { success: false, error: 'INVALID_AMOUNT' };
    const providerRef = `mock-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return { success: true, providerRef };
  }

  async capture(providerRef: string): Promise<CaptureResult> {
    return { success: true };
  }

  async refund(providerRef: string, amount: number): Promise<RefundResult> {
    if (!providerRef) return { success: false, error: 'NO_PROVIDER_REF' };
    return { success: true };
  }
}
