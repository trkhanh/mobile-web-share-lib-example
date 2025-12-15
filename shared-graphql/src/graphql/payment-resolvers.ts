import { SharedServices } from '../factories/service-factory';

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
