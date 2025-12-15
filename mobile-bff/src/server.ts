import { ApolloServer } from 'apollo-server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { payeeTypeDefs } from '../../shared-graphql/src/graphql/payee-schema';
import { createServices } from '../../shared-graphql/src/factories/service-factory';
import { makePayeeResolvers } from '../../shared-graphql/src/graphql/payee-resolvers';

// Create shared services with factory (uses env flags or defaults)
const services = createServices();

// Get base resolvers from shared library
const baseResolvers = makePayeeResolvers(services);

// Mobile BFF adds mobile-specific fields
const mobileResolvers = {
  Query: {
    ...baseResolvers.Query,
    validatePayee: async (_: any, { input }: any, context: any) => {
      const result = await services.payeeService.validatePayee(input);
      return {
        ...result,
        mobileOptimizedPayload: JSON.stringify({ ...result, deviceId: 'mobile-device-123' })
      };
    }
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
