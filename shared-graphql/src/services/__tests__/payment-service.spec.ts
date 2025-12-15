import { PaymentService } from '../../services/payment-service';
import { InMemoryPaymentStore } from '../../infra/in-memory-payment-store';
import { MockGateway } from '../../infra/mock-gateway';
import { ILogger } from '../../ports/logger';

const logger: ILogger = { info: () => {}, warn: () => {}, error: () => {} };

describe('PaymentService', () => {
  test('creates and completes a valid payment', async () => {
    const store = new InMemoryPaymentStore();
    const gateway = new MockGateway();
    const svc = new PaymentService(store, gateway, logger);

    const result = await svc.createPayment({ amount: 50, currency: 'USD', fromAccount: 'A', toAccount: 'B' });
    expect(result.success).toBe(true);
    expect(result.paymentId).toBeDefined();

    const payment = await store.get(result.paymentId as string);
    expect(payment).not.toBeNull();
    expect(payment!.status).toBe('COMPLETED');
  });

  test('fails authorization for invalid amount', async () => {
    const store = new InMemoryPaymentStore();
    const gateway = new MockGateway();
    const svc = new PaymentService(store, gateway, logger);

    const result = await svc.createPayment({ amount: 0, currency: 'USD', fromAccount: 'A', toAccount: 'B' });
    expect(result.success).toBe(false);
    expect(result.reason).toBeDefined();
  });
});
