import { ApolloServer } from 'apollo-server';
import { ApolloGateway, IntrospectAndCompose } from '@apollo/gateway';

// ============================================================================
// SUPERGRAPH GATEWAY - Apollo Federation V2
// ============================================================================

console.log('\n🌐 Starting SuperGraph Gateway (Apollo Federation V2)');
console.log('   ✅ Composes multiple subgraphs into unified API');
console.log('   ✅ Handles query planning across subgraphs');
console.log('   ✅ Single endpoint for all clients');
console.log('');

// Define subgraph endpoints
const subgraphs = [
  {
    name: 'payment',
    url: process.env.PAYMENT_SUBGRAPH_URL || 'http://localhost:4001/graphql'
  },
  {
    name: 'user',
    url: process.env.USER_SUBGRAPH_URL || 'http://localhost:4002/graphql'
  }
];

console.log('📡 Configured Subgraphs:');
subgraphs.forEach(sg => {
  console.log(`   - ${sg.name}: ${sg.url}`);
});
console.log('');

// Create Apollo Gateway
const gateway = new ApolloGateway({
  supergraphSdl: new IntrospectAndCompose({
    subgraphs
  }),
  debug: true
});

// Create Apollo Server with gateway
const server = new ApolloServer({
  gateway,
  
  // Disable subscriptions for gateway (not supported in basic federation)
  subscriptions: false,
  
  context: ({ req }: any) => {
    // Forward headers and context to subgraphs
    return {
      headers: req?.headers || {},
      userId: req?.headers?.['x-user-id'],
      sessionId: req?.headers?.['x-session-id']
    };
  }
});

const PORT = process.env.PORT || 4000;

server.listen(PORT).then(({ url }) => {
  console.log(`🚀 SuperGraph Gateway ready at ${url}`);
  console.log(`📊 GraphQL Playground available at ${url}`);
  console.log('\n💡 All subgraphs composed into a single unified schema');
  console.log('💡 Clients can query across subgraphs in a single request');
});
