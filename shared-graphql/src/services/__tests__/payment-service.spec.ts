import { createPaymentService } from '../../services/payment-service-functional';
import { createInMemoryPaymentStore } from '../../infra/in-memory-payment-store-functional';
import { createMockGateway } from '../../infra/mock-gateway-functional';
import { ILogger } from '../../ports/logger';

const logger: ILogger = { info: () => {}, warn: () => {}, error: () => {} };

describe('PaymentService', () => {
  test('creates and completes a valid payment', async () => {
    const store = createInMemoryPaymentStore();
    const gateway = createMockGateway();
    const svc = createPaymentService({ store, gateway, logger });

    const result = await svc.createPayment({ amount: 50, currency: 'USD', fromAccount: '12345678', toAccount: '87654321' });
    expect(result.success).toBe(true);
    expect(result.paymentId).toBeDefined();

    const payment = await store.get(result.paymentId as string);
    expect(payment).not.toBeNull();
    expect(payment!.status).toBe('COMPLETED');
  });

  test('fails authorization for invalid amount', async () => {
    const store = createInMemoryPaymentStore();
    const gateway = createMockGateway();
    const svc = createPaymentService({ store, gateway, logger });

    const result = await svc.createPayment({ amount: 0, currency: 'USD', fromAccount: '12345678', toAccount: '87654321' });
    expect(result.success).toBe(false);
    expect(result.reason).toBeDefined();
  });
});
