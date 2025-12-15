import { IPaymentGateway } from '../ports/gateway';
import { IPaymentStore } from '../ports/payment-store';
import { CreatePaymentRequest, Payment } from '../types/payment';
import { ILogger } from '../ports/logger';

/**
 * PaymentService - orchestrates payment flows
 *
 * SOLID mapping:
 * - Single Responsibility: this class is responsible for payment orchestration
 *   (create -> authorize -> complete). Persistence and gateway communication
 *   are delegated to `IPaymentStore` and `IPaymentGateway` respectively.
 * - Open/Closed: the service depends on abstractions. New gateway/store
 *   implementations or additional behavior can be introduced without
 *   modifying this class (extend by providing new implementations or
 *   subclassing if necessary).
 * - Liskov Substitution: implementations of `IPaymentStore` and
 *   `IPaymentGateway` must honor the contracts so they can be substituted
 *   without changing `PaymentService` behavior.
 * - Interface Segregation: `PaymentService` depends on small, focused
 *   interfaces (`IPaymentStore`, `IPaymentGateway`, `ILogger`) rather than
 *   a large multipurpose API.
 * - Dependency Inversion: high-level module (`PaymentService`) depends on
 *   abstractions. Concrete implementations are injected via the constructor.
 */
export class PaymentService {
  // dependencies are injected to follow Dependency Inversion and to make the
  // service easy to test and extend.
  constructor(private store: IPaymentStore, private gateway: IPaymentGateway, private logger: ILogger) {}

  async createPayment(req: CreatePaymentRequest) {
    // create pending record
    const payment = await this.store.create({
      amount: req.amount,
      currency: req.currency,
      fromAccount: req.fromAccount,
      toAccount: req.toAccount,
      status: 'PENDING'
    } as any);

    // authorize via gateway abstraction
    const auth = await this.gateway.authorize(req.amount, req.currency, req.fromAccount, req.toAccount);
    if (!auth.success) {
      await this.store.updateStatus(payment.id, 'FAILED');
      this.logger?.warn('Payment authorization failed', { paymentId: payment.id, error: auth.error });
      return { success: false, paymentId: payment.id, reason: auth.error };
    }

    // in this simple flow, mark as completed
    await this.store.updateStatus(payment.id, 'COMPLETED', auth.providerRef);
    this.logger?.info('Payment completed', { paymentId: payment.id, providerRef: auth.providerRef });
    return { success: true, paymentId: payment.id };
  }
}
