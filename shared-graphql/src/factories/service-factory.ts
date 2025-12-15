import { ConsoleLogger } from '../infra/console-logger';
import { InMemoryPaymentStore } from '../infra/in-memory-payment-store';
import { MockGateway } from '../infra/mock-gateway';
import { HttpPaymentGateway } from '../infra/http-gateway';
import { MockPayeeDataSource } from '../infra/mock-payee-data-source';
import { HttpPayeeDataSource } from '../infra/http-payee-data-source';
import { PaymentService } from '../services/payment-service';
import { PayeeService } from '../services/payee-service';
import { ILogger } from '../ports/logger';
import { IPaymentGateway } from '../ports/gateway';
import { IPaymentStore } from '../ports/payment-store';
import { IPayeeDataSource } from '../ports/payee-data-source';

export interface SharedServices {
  logger: ILogger;
  paymentService: PaymentService;
  payeeService: PayeeService;
}

export function createServices(overrides?: {
  logger?: ILogger;
  paymentStore?: IPaymentStore;
  paymentGateway?: IPaymentGateway;
  payeeDataSource?: IPayeeDataSource;
}): SharedServices {
  /**
   * SOLID notes for this factory
   * - Single Responsibility: this factory only composes and returns shared
   *   service instances; it does not implement business logic.
   * - Open/Closed: callers can pass `overrides` to alter behavior without
   *   changing this function (extend via injection, don't modify code).
   * - Dependency Inversion: higher-level services are constructed with
   *   abstractions (`IPaymentStore`, `IPaymentGateway`, `ILogger`, `IPayeeDataSource`)
   *   rather than concrete implementations; concrete wiring happens here.
   */
  const logger = overrides?.logger ?? new ConsoleLogger();
  const paymentStore = overrides?.paymentStore ?? new InMemoryPaymentStore();
  
  // Payment gateway selection
  let paymentGateway: IPaymentGateway;
  if (overrides?.paymentGateway) {
    paymentGateway = overrides.paymentGateway;
  } else if (process.env.USE_WIREMOCK === 'true') {
    const url = process.env.PAYMENT_STUB_URL ?? 'http://localhost:8080';
    paymentGateway = new HttpPaymentGateway(url);
  } else {
    paymentGateway = new MockGateway();
  }

  // Payee data source selection (similar pattern to payment gateway)
  let payeeDataSource: IPayeeDataSource;
  if (overrides?.payeeDataSource) {
    payeeDataSource = overrides.payeeDataSource;
  } else if (process.env.USE_PAYEE_REGISTRY === 'true') {
    const url = process.env.PAYEE_REGISTRY_URL ?? 'http://localhost:8080';
    payeeDataSource = new HttpPayeeDataSource(url);
  } else {
    payeeDataSource = new MockPayeeDataSource();
  }

  const paymentService = new PaymentService(paymentStore, paymentGateway, logger);
  const payeeService = new PayeeService(payeeDataSource, logger);

  return { logger, paymentService, payeeService };
}
