import { IPaymentStore } from '../ports/payment-store';
import { Payment } from '../types/payment';

export class InMemoryPaymentStore implements IPaymentStore {
  private map = new Map<string, Payment>();

  async create(payload: Omit<Payment, 'id' | 'status' | 'createdAt'>): Promise<Payment> {
    const id = `p_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const createdAt = new Date().toISOString();
    const payment: Payment = { id, ...payload, status: 'PENDING', createdAt } as Payment;
    this.map.set(id, payment);
    return payment;
  }

  async updateStatus(paymentId: string, status: Payment['status'], providerRef?: string): Promise<void> {
    const p = this.map.get(paymentId);
    if (!p) throw new Error('NOT_FOUND');
    p.status = status;
    if (providerRef) p.providerRef = providerRef;
    this.map.set(paymentId, p);
  }

  async get(paymentId: string): Promise<Payment | null> {
    return this.map.get(paymentId) ?? null;
  }
}
