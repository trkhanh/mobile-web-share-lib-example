import { IPaymentStore } from '../ports/payment-store';
import { Payment } from '../types/payment';

/**
 * Functional in-memory store factory
 * 
 * Uses closure to encapsulate state instead of class instance variables
 * State management with pure function interface
 */
export const createInMemoryPaymentStore = (): IPaymentStore => {
  // Closure-based state (private to this factory)
  const map = new Map<string, Payment>();

  return {
    create: async (payload: Omit<Payment, 'id' | 'status' | 'createdAt'>): Promise<Payment> => {
      const id = `p_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const createdAt = new Date().toISOString();
      const payment: Payment = { id, ...payload, status: 'PENDING', createdAt } as Payment;
      map.set(id, payment);
      return payment;
    },

    updateStatus: async (paymentId: string, status: Payment['status'], providerRef?: string): Promise<void> => {
      const p = map.get(paymentId);
      if (!p) throw new Error('NOT_FOUND');
      p.status = status;
      if (providerRef) p.providerRef = providerRef;
      map.set(paymentId, p);
    },

    get: async (paymentId: string): Promise<Payment | null> => {
      return map.get(paymentId) ?? null;
    }
  };
};
