import { createConsoleLogger } from '../infra/console-logger-functional';
import { createInMemoryPaymentStore } from '../infra/in-memory-payment-store-functional';
import { createMockGateway } from '../infra/mock-gateway-functional';
import { createHttpPaymentGateway } from '../infra/http-gateway-functional';
import { createMockPayeeDataSource } from '../infra/mock-payee-data-source-functional';
import { createHttpPayeeDataSource } from '../infra/http-payee-data-source-functional';
import { createPaymentService, PaymentService } from '../services/payment-service-functional';
import { createPayeeService, PayeeService } from '../services/payee-service-functional';
import { ILogger } from '../ports/logger';
import { IPaymentGateway } from '../ports/gateway';
import { IPaymentStore } from '../ports/payment-store';
import { IPayeeDataSource } from '../ports/payee-data-source';

/**
 * Functional factory pattern:
 * - Composes services using functional factories
 * - No class instantiation ceremony
 * - Pure dependency injection
 */
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
  const logger = overrides?.logger ?? createConsoleLogger();
  const paymentStore = overrides?.paymentStore ?? createInMemoryPaymentStore();
  
  // Payment gateway selection
  let paymentGateway: IPaymentGateway;
  if (overrides?.paymentGateway) {
    paymentGateway = overrides.paymentGateway;
  } else if (process.env.USE_WIREMOCK === 'true') {
    const url = process.env.PAYMENT_STUB_URL ?? 'http://localhost:8080';
    paymentGateway = createHttpPaymentGateway(url);
  } else {
    paymentGateway = createMockGateway();
  }

  // Payee data source selection (similar pattern to payment gateway)
  let payeeDataSource: IPayeeDataSource;
  if (overrides?.payeeDataSource) {
    payeeDataSource = overrides.payeeDataSource;
  } else if (process.env.USE_PAYEE_REGISTRY === 'true') {
    const url = process.env.PAYEE_REGISTRY_URL ?? 'http://localhost:8080';
    payeeDataSource = createHttpPayeeDataSource(url);
  } else {
    payeeDataSource = createMockPayeeDataSource();
  }

  // Create services using functional factories (no "new" keyword)
  const paymentService = createPaymentService({
    store: paymentStore,
    gateway: paymentGateway,
    logger
  });

  const payeeService = createPayeeService({
    dataSource: payeeDataSource,
    logger
  });

  return { logger, paymentService, payeeService };
}
