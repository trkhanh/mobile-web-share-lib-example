import { Payment } from '../types/payment';

/**
 * Payment store port
 *
 * SOLID notes:
 * - Single Responsibility: the store interface focuses only on persistence
 *   concerns (create/update/get) and nothing about business rules.
 * - Interface Segregation: the interface is small and specific so callers are
 *   not forced to depend on unrelated persistence operations.
 * - Dependency Inversion: higher-level services depend on this abstraction
 *   allowing different storage implementations (in-memory, DB, mocked store)
 *   to be injected.
 */
export interface IPaymentStore {
  create(payload: Omit<Payment, 'id' | 'status' | 'createdAt'>): Promise<Payment>;
  updateStatus(paymentId: string, status: Payment['status'], providerRef?: string): Promise<void>;
  get(paymentId: string): Promise<Payment | null>;
  list(): Promise<Payment[]>;
}
