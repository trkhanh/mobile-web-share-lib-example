import { ApolloServer } from 'apollo-server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { payeeTypeDefs } from '../../shared-graphql/src/schema/payee';
import { createPayeeService } from '../../shared-graphql/src/services/payee-service';

const mobileDataSource = {
  fetchRegisteredName: async (accountNumber: string, bankCode: string) => {
    // Mock mobile-specific API call
    if (accountNumber === '12345678') return 'Acme Corp';
    return 'Mobile Lookup Name';
  }
};

const payeeService = createPayeeService({
  dataSource: mobileDataSource,
  logger: console
});

const mobileResolvers = {
  Query: {
    validatePayee: async (_: any, { input }: any, context: any) => {
      const result = await payeeService.validatePayee(input);
      return {
        ...result,
        mobileOptimizedPayload: JSON.stringify({ ...result, deviceId: 'mobile-device-123' })
      };
    },
    getPayee: async (_: any, { id }: any) => payeeService.getPayee(id)
  }
};

const schema = makeExecutableSchema({
  typeDefs: [payeeTypeDefs],
  resolvers: mobileResolvers as any
});

const server = new ApolloServer({ schema });

server.listen({ port: 4001 }).then(({ url }) => {
  console.log(`🚀 Mobile BFF ready at ${url}`);
});
