import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { payeeTypeDefs } from '../../shared-graphql/src/graphql/payee-schema';
import { createPayeeService } from '../../shared-graphql/src/services/payee-service';

const webDataSource = {
  fetchRegisteredName: async (accountNumber: string, bankCode: string) => {
    if (accountNumber === '11111111') return 'John Doe';
    return 'Web Lookup Name';
  }
};

const payeeService = createPayeeService({ dataSource: webDataSource, logger: console });

const webTypeDefs = `
extend type ValidatePayeeResult {
  validationId: ID!
}
`;

const webResolvers = {
  Query: {
    validatePayee: async (_: any, { input }: any, context: any) => {
      const result = await payeeService.validatePayee(input);
      return {
        ...result,
        validationId: `val_${Date.now()}`
      };
    },
    getPayee: async (_: any, { id }: any) => payeeService.getPayee(id)
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
