import { ApolloServer } from 'apollo-server';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { createServices } from './factories/service-factory';
import { makePaymentResolvers } from './graphql/payment-resolvers';
import { paymentTypeDefs } from './graphql/payment-schema';

// ============================================================================
// PAYMENT SUBGRAPH - Apollo Federation V2
// ============================================================================

console.log('\n🚀 Starting Payment Subgraph (Federation V2)');
console.log('   ✅ Federated Schema with @key directives');
console.log('   ✅ Entity resolver for Payment type');
console.log('   ✅ Independent deployment as microservice');
console.log('');

// Create services with default implementations
const services = createServices();

// Get federation-ready resolvers
const paymentResolvers = makePaymentResolvers(services);

// Build federated subgraph schema
const schema = buildSubgraphSchema({
  typeDefs: paymentTypeDefs,
  resolvers: paymentResolvers as any
});

// Create Apollo Server for subgraph
const server = new ApolloServer({
  schema,
  context: ({ req }: any) => {
    return {
      // Context can include headers, auth info from gateway
      headers: req?.headers || {}
    };
  }
});

const PORT = process.env.PORT || 4001;

server.listen(PORT).then(({ url }) => {
  console.log(`🚀 Payment Subgraph ready at ${url}`);
  console.log(`📊 GraphQL Playground available at ${url}`);
  console.log('\n💡 This subgraph can be composed into a SuperGraph Gateway');
});
