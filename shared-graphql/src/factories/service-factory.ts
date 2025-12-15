import { ConsoleLogger } from '../infra/console-logger';
import { InMemoryPaymentStore } from '../infra/in-memory-payment-store';
import { MockGateway } from '../infra/mock-gateway';
import { HttpPaymentGateway } from '../infra/http-gateway';
import { PaymentService } from '../services/payment-service';
import { ILogger } from '../ports/logger';
import { IPaymentGateway } from '../ports/gateway';
import { IPaymentStore } from '../ports/payment-store';

export interface SharedServices {
  logger: ILogger;
  paymentService: PaymentService;
  // extend with other services: payeeService, refundService, fraudService...
}

export function createServices(overrides?: {
  logger?: ILogger;
  paymentStore?: IPaymentStore;
  paymentGateway?: IPaymentGateway;
}): SharedServices {
  /**
   * SOLID notes for this factory
   * - Single Responsibility: this factory only composes and returns shared
   *   service instances; it does not implement business logic.
   * - Open/Closed: callers can pass `overrides` to alter behavior without
   *   changing this function (extend via injection, don't modify code).
   * - Dependency Inversion: higher-level services are constructed with
   *   abstractions (`IPaymentStore`, `IPaymentGateway`, `ILogger`) rather than
   *   concrete implementations; concrete wiring happens here.
   */
  const logger = overrides?.logger ?? new ConsoleLogger();
  const paymentStore = overrides?.paymentStore ?? new InMemoryPaymentStore();
  let paymentGateway: IPaymentGateway;
  if (overrides?.paymentGateway) {
    paymentGateway = overrides.paymentGateway;
  } else if (process.env.USE_WIREMOCK === 'true') {
    const url = process.env.PAYMENT_STUB_URL ?? 'http://localhost:8080';
    paymentGateway = new HttpPaymentGateway(url);
  } else {
    paymentGateway = new MockGateway();
  }

  const paymentService = new PaymentService(paymentStore, paymentGateway, logger);

  return { logger, paymentService };
}
