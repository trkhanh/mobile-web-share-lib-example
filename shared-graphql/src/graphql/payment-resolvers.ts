import { SharedServices } from '../factories/service-factory';

/**
 * Functional GraphQL resolver factory for payments
 *
 * Functional approach:
 * - Pure resolver composition (functions returning functions)
 * - GraphQL resolvers are inherently functional
 * - Simple dependency injection via closure
 * - No classes needed - resolvers are just functions
 */
export const makePaymentResolvers = (services: SharedServices) => {
  const { paymentService } = services;

  return {
    Mutation: {
      createPayment: async (_: any, { input }: any) => {
        return await paymentService.createPayment(input);
      }
    },
    Query: {
      getPayment: async (_: any, { id }: any) => {
        return await paymentService.getPayment(id);
      }
    }
  };
};
