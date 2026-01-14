import { SharedServices } from '../factories/service-factory';

/**
 * GraphQL resolver factory for payments (Federation V2)
 *
 * SOLID notes:
 * - Single Responsibility: this module only adapts service methods to GraphQL
 *   resolver handlers; it doesn't implement business rules.
 * - Dependency Inversion: it receives `SharedServices` (abstractions and
 *   composed services) from the factory so concrete wiring happens elsewhere.
 * - Open/Closed: additional resolver behavior can be added without changing
 *   existing wiring by wrapping or extending the resolver factory.
 *
 * Federation V2 additions:
 * - __resolveReference: Entity resolver for Payment type
 * - Query resolvers: Owned by this subgraph
 */
export const makePaymentResolvers = (services: SharedServices) => {
  const { paymentService } = services;

  return {
    Payment: {
      // Federation entity resolver
      __resolveReference: async (reference: { id: string }) => {
        const payments = await paymentService.listPayments();
        return payments.find(p => p.id === reference.id) || null;
      },

      // Resolve User reference from user-subgraph
      user: (payment: any) => {
        return { __typename: 'User', id: payment.userId };
      }
    },

    User: {
      // Extend User type with payments field
      payments: async (user: { id: string }) => {
        const payments = await paymentService.listPayments();
        return payments.filter(p => p.userId === user.id);
      }
    },

    Query: {
      payment: async (_: any, { id }: { id: string }) => {
        const payments = await paymentService.listPayments();
        return payments.find(p => p.id === id) || null;
      },

      payments: async (_: any) => {
        return await paymentService.listPayments();
      },

      paymentsByUser: async (_: any, { userId }: { userId: string }) => {
        const payments = await paymentService.listPayments();
        return payments.filter(p => p.userId === userId);
      }
    },

    Mutation: {
      createPayment: async (_: any, { input }: any) => {
        return await paymentService.createPayment(input);
      }
    }
  };
};
