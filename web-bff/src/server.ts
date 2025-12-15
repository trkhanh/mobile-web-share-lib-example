import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { payeeTypeDefs } from '../../shared-graphql/src/graphql/payee-schema';
import { createServices } from '../../shared-graphql/src/factories/service-factory';
import { makePayeeResolvers } from '../../shared-graphql/src/graphql/payee-resolvers';

// Create shared services with factory (uses env flags or defaults)
const services = createServices();

// Get base resolvers from shared library
const baseResolvers = makePayeeResolvers(services);

const webTypeDefs = `
extend type ValidatePayeeResult {
  validationId: ID!
}
`;

// Web BFF adds web-specific fields
const webResolvers = {
  Query: {
    ...baseResolvers.Query,
    validatePayee: async (_: any, { input }: any, context: any) => {
      const result = await services.payeeService.validatePayee(input);
      return {
        ...result,
        validationId: `val_${Date.now()}`
      };
    }
  }
};

async function start() {
  const app = express();

  const schema = makeExecutableSchema({ typeDefs: [payeeTypeDefs], resolvers: webResolvers as any });

  const server = new ApolloServer({ schema });
  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  app.listen(4002, () => {
    console.log('🚀 Web BFF ready at http://localhost:4002/graphql');
  });
}

start().catch(e => console.error(e));
