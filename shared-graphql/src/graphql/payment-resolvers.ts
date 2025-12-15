import { SharedServices } from '../factories/service-factory';

/**
 * GraphQL resolver factory for payments
 *
 * SOLID notes:
 * - Single Responsibility: this module only adapts service methods to GraphQL
 *   resolver handlers; it doesn't implement business rules.
 * - Dependency Inversion: it receives `SharedServices` (abstractions and
 *   composed services) from the factory so concrete wiring happens elsewhere.
 * - Open/Closed: additional resolver behavior can be added without changing
 *   existing wiring by wrapping or extending the resolver factory.
 */
export const makePaymentResolvers = (services: SharedServices) => {
  const { paymentService } = services;

  return {
    Mutation: {
      createPayment: async (_: any, { input }: any) => {
        return await paymentService.createPayment(input);
      }
    }
  };
};
