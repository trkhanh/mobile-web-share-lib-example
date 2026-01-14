# Phase 1 vs Phase 2 - Quick Comparison

## Architecture Comparison

| Aspect | Phase 1: Shared Library | Phase 2: SuperGraph |
|--------|------------------------|---------------------|
| **Pattern** | Monorepo with shared npm package | Independent federated microservices |
| **Deployment** | Multiple BFF servers (mobile, web) | Gateway + Independent subgraphs |
| **Endpoints** | Multiple (one per BFF) | Single (gateway) |
| **Schema** | Each BFF composes own schema | Gateway composes unified schema |
| **Cross-domain queries** | Client-side joins required | Single query across subgraphs |
| **Scaling** | Scale each BFF independently | Scale each subgraph independently |
| **Team ownership** | Shared codebase | Each team owns subgraph |

## Code Structure

### Phase 1
```
shared-graphql/           # Shared library
  ├── src/
  │   ├── services/       # Business logic
  │   ├── graphql/        # Schema & resolvers
  │   └── types/
mobile-bff/               # Consumer 1
  └── src/server.ts       # Apollo Server (imports shared lib)
web-bff/                  # Consumer 2
  └── src/server.ts       # Apollo Server (imports shared lib)
```

### Phase 2
```
gateway/                  # SuperGraph Gateway
  └── src/index.ts        # Apollo Gateway (composes subgraphs)
shared-graphql/           # Payment Subgraph (formerly shared lib)
  └── src/
      ├── subgraph-server.ts     # Federation server
      └── graphql/
          ├── payment-schema.ts  # @key, extend User
          └── payment-resolvers.ts # __resolveReference
user-subgraph/            # User Subgraph (new)
  └── src/
      ├── index.ts        # Federation server
      └── schema.ts       # @key directives
```

## Example Query

### Phase 1: Multiple Requests Required

```graphql
# Request 1 to User BFF
query {
  user(id: "user-1") {
    id
    name
  }
}

# Request 2 to Payment BFF
query {
  paymentsByUser(userId: "user-1") {
    id
    amount
  }
}
```

Client must join data.

### Phase 2: Single Request

```graphql
# Single request to Gateway
query {
  user(id: "user-1") {
    id
    name
    # Automatically fetched from Payment subgraph!
    payments {
      id
      amount
    }
  }
}
```

Gateway handles joins automatically.

## Schema Definition

### Phase 1

```typescript
// shared-graphql/src/graphql/payment-schema.ts
export const paymentTypeDefs = `
  type Payment {
    id: ID!
    amount: Float!
  }
  
  extend type Mutation {
    createPayment(input: CreatePaymentInput!): CreatePaymentResult!
  }
`;
```

Standard GraphQL, each BFF imports and extends.

### Phase 2

```typescript
// shared-graphql/src/graphql/payment-schema.ts
export const paymentTypeDefs = gql`
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.3", 
          import: ["@key", "@shareable"])

  type Payment @key(fields: "id") {
    id: ID!
    amount: Float!
    user: User  # Reference to User subgraph
  }
  
  # Extend User from user-subgraph
  extend type User @key(fields: "id") {
    id: ID! @external
    payments: [Payment!]!  # Resolved here
  }
`;
```

Federation directives enable cross-subgraph relationships.

## Resolvers

### Phase 1

```typescript
export const makePaymentResolvers = (services) => ({
  Mutation: {
    createPayment: async (_, { input }) => {
      return await services.paymentService.createPayment(input);
    }
  }
});
```

Simple resolvers, no federation concepts.

### Phase 2

```typescript
export const makePaymentResolvers = (services) => ({
  Payment: {
    // Entity resolver for federation
    __resolveReference: async (reference: { id: string }) => {
      return await services.paymentService.getPayment(reference.id);
    },
    
    // Return reference stub for User
    user: (payment) => {
      return { __typename: 'User', id: payment.userId };
    }
  },
  
  User: {
    // Extend User with payments field
    payments: async (user: { id: string }) => {
      return await services.paymentService.getPaymentsByUser(user.id);
    }
  },
  
  Mutation: {
    createPayment: async (_, { input }) => {
      return await services.paymentService.createPayment(input);
    }
  }
});
```

Entity resolvers, reference resolution, type extensions.

## Running the Services

### Phase 1

```bash
# Terminal 1
cd mobile-bff && npm start  # Port 4001

# Terminal 2
cd web-bff && npm start     # Port 4002
```

### Phase 2

```bash
# Terminal 1
cd shared-graphql && npm run start:subgraph  # Port 4001

# Terminal 2
cd user-subgraph && npm start                # Port 4002

# Terminal 3
cd gateway && npm start                      # Port 4000
```

Or simply:
```bash
./run-phase2.sh
```

## When to Use Each

### Use Phase 1 (Shared Library) When:
- ✅ Small team, single codebase preferred
- ✅ Simple domain, few cross-cutting concerns
- ✅ BFFs need deep customization
- ✅ Don't need independent service scaling
- ✅ Want tight coupling for faster iteration

### Use Phase 2 (SuperGraph) When:
- ✅ Multiple teams, need clear ownership boundaries
- ✅ Complex domain with many services
- ✅ Need independent deployment & scaling
- ✅ Want single API endpoint for clients
- ✅ Cross-service queries are common
- ✅ Microservices architecture preferred

## Migration Path

1. ✅ **Start with Phase 1** - Simple, fast to build
2. 🔄 **Identify boundaries** - When services grow, identify domain boundaries
3. 🔄 **Extract subgraphs** - Convert shared lib modules to independent services
4. ✅ **Add gateway** - Compose subgraphs with Apollo Gateway
5. ✅ **Add federation** - Implement @key, __resolveReference
6. ✅ **Update clients** - Point to gateway instead of individual BFFs

## Key Takeaways

| | Phase 1 | Phase 2 |
|-|---------|---------|
| **Complexity** | Lower | Higher |
| **Flexibility** | Medium | High |
| **Scalability** | BFF-level | Service-level |
| **Team autonomy** | Shared codebase | Independent services |
| **Client complexity** | Multiple endpoints | Single endpoint |
| **Deployment** | Coupled | Decoupled |
| **Best for** | Startups, MVPs | Mature products, enterprises |

## Current Branch Status

**You are on:** `phase-2-supergraph` ✅

To switch back to Phase 1:
```bash
git checkout main
./run-all.sh
```

To test Phase 2:
```bash
./run-phase2.sh
# Then in another terminal:
cd gateway && npx ts-node demo-client.ts
```
