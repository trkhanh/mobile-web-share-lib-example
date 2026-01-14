import { ApolloServer } from 'apollo-server';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { UserService } from './user-service';
import { createUserResolvers } from './resolvers';
import { userTypeDefs } from './schema';

// ============================================================================
// USER SUBGRAPH - Apollo Federation V2
// ============================================================================

console.log('\n🚀 Starting User Subgraph (Federation V2)');
console.log('   ✅ Federated Schema with @key directives');
console.log('   ✅ Entity resolver for User type');
console.log('   ✅ Independent deployment as microservice');
console.log('');

// Create user service
const userService = new UserService();

// Get federation-ready resolvers
const userResolvers = createUserResolvers(userService);

// Build federated subgraph schema
const schema = buildSubgraphSchema({
  typeDefs: userTypeDefs,
  resolvers: userResolvers as any
});

// Create Apollo Server for subgraph
const server = new ApolloServer({
  schema,
  context: ({ req }: any) => {
    return {
      // Context can include headers, auth info from gateway
      headers: req?.headers || {},
      userId: req?.headers?.['x-user-id']
    };
  }
});

const PORT = process.env.PORT || 4002;

server.listen(PORT).then(({ url }) => {
  console.log(`🚀 User Subgraph ready at ${url}`);
  console.log(`📊 GraphQL Playground available at ${url}`);
  console.log('\n💡 This subgraph can be composed into a SuperGraph Gateway');
});
