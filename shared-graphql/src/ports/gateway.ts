/**
 * Ports / Gateway interfaces
 *
 * SOLID notes:
 * - Interface Segregation: the gateway exposes a focused interface for
 *   payment operations (authorize / capture / refund). Consumers depend only
 *   on the methods they need.
 * - Dependency Inversion: callers should depend on this abstraction
 *   (`IPaymentGateway`) rather than concrete gateway implementations. Different
 *   gateways (HTTP, mock, wiremock proxy) can be swapped without changing
 *   consumers.
 */

export interface AuthorizationResult {
  success: boolean;
  providerRef?: string;
  error?: string;
}

export interface CaptureResult {
  success: boolean;
  error?: string;
}

export interface RefundResult {
  success: boolean;
  error?: string;
}

export interface IPaymentGateway {
  authorize(amount: number, currency: string, from: string, to: string): Promise<AuthorizationResult>;
  capture(providerRef: string): Promise<CaptureResult>;
  refund(providerRef: string, amount: number): Promise<RefundResult>;
}
