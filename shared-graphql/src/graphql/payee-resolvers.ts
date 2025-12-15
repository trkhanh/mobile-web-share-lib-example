import { SharedServices } from '../factories/service-factory';

/**
 * GraphQL resolver factory for payees
 *
 * SOLID notes:
 * - Single Responsibility: adapts PayeeService methods to GraphQL resolver handlers.
 * - Dependency Inversion: receives SharedServices from the factory.
 */
export const makePayeeResolvers = (services: SharedServices) => {
  const { payeeService } = services;

  return {
    Query: {
      validatePayee: async (_: any, { input }: any) => {
        return await payeeService.validatePayee(input);
      }
    }
  };
};
