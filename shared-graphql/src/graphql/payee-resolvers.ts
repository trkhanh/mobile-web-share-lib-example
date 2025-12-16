import { SharedServices } from '../factories/service-factory';

/**
 * Functional GraphQL resolver factory for payees
 *
 * Functional approach:
 * - Thin adapter functions over service methods
 * - Pure functional composition
 * - GraphQL resolvers are naturally functional
 */
export const makePayeeResolvers = (services: SharedServices) => {
  const { payeeService } = services;

  return {
    Query: {
      validatePayee: async (_: any, { input }: any) => {
        return await payeeService.validatePayee(input);
      },
      validatePayeeBatch: async (_: any, { inputs }: any) => {
        return await payeeService.validateBatch(inputs);
      }
    }
  };
};
