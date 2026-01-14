# Phase 2: SuperGraph Architecture Guide

## Overview

Phase 2 implements **Apollo Federation V2** to create a SuperGraph architecture. The shared library has been transformed into independent federated subgraphs that are composed by a central gateway.

## Architecture

```
┌─────────────────────────────────────────────────┐
│           Clients (Web, Mobile, etc)            │
└─────────────────┬───────────────────────────────┘
                  │
                  │ Single Endpoint
                  ▼
┌─────────────────────────────────────────────────┐
│        SuperGraph Gateway (Port 4000)           │
│  - Query Planning & Composition                 │
│  - Entity Resolution                            │
│  - Unified Schema                               │
└───────────┬─────────────────┬───────────────────┘
            │                 │
    ┌───────▼──────┐   ┌─────▼──────────┐
    │  Payment     │   │  User          │
    │  Subgraph    │   │  Subgraph      │
    │  (Port 4001) │   │  (Port 4002)   │
    │              │   │                │
    │  - Payments  │   │  - Users       │
    │  - Mutations │   │  - Auth        │
    └──────────────┘   └────────────────┘
```

## Key Changes from Phase 1

### Phase 1 (Shared Library)
- ❌ Multiple BFF servers importing shared library
- ❌ Duplicate GraphQL endpoints
- ❌ Each BFF manages own Apollo Server
- ❌ No cross-domain queries without client-side joins

### Phase 2 (SuperGraph)
- ✅ Single Gateway endpoint
- ✅ Independent subgraph microservices
- ✅ Automatic entity resolution across subgraphs
- ✅ Cross-subgraph queries in single request

## Project Structure

```
mobile-web-share-lib-example/
├── gateway/                    # SuperGraph Gateway
│   ├── src/
│   │   └── index.ts           # Apollo Gateway server
│   ├── demo-client.ts         # Demo queries
│   ├── package.json
│   └── Dockerfile
│
├── shared-graphql/            # Payment Subgraph (formerly shared lib)
│   ├── src/
│   │   ├── subgraph-server.ts # Federated subgraph server
│   │   ├── graphql/
│   │   │   ├── payment-schema.ts    # @key, extend User
│   │   │   └── payment-resolvers.ts # __resolveReference
│   │   └── ...
│   └── Dockerfile.subgraph
│
├── user-subgraph/             # User Subgraph (new)
│   ├── src/
│   │   ├── index.ts           # User subgraph server
│   │   ├── schema.ts          # User @key type
│   │   ├── resolvers.ts       # User resolvers
│   │   └── user-service.ts    # User business logic
│   └── Dockerfile
│
├── docker-compose.phase2.yml  # Phase 2 infrastructure
└── run-phase2.sh              # Startup script
```

## Federation Concepts

### 1. Entity Types with @key

Entities are types that can be referenced across subgraphs:

```graphql
# Payment Subgraph
type Payment @key(fields: "id") {
  id: ID!
  amount: Float!
  userId: ID!
  user: User  # Reference to User subgraph
}

# User Subgraph
type User @key(fields: "id") {
  id: ID!
  name: String!
  email: String!
}
```

### 2. Extending Types Across Subgraphs

Payment subgraph extends User to add `payments` field:

```graphql
# In Payment Subgraph
extend type User @key(fields: "id") {
  id: ID! @external
  payments: [Payment!]!  # Resolved by Payment subgraph
}
```

### 3. Entity Resolvers

Each entity needs a `__resolveReference` resolver:

```typescript
Payment: {
  __resolveReference: async (reference: { id: string }) => {
    return await paymentService.getPayment(reference.id);
  }
}
```

### 4. Cross-Subgraph References

```typescript
Payment: {
  // Return a reference stub - Gateway resolves it
  user: (payment) => {
    return { __typename: 'User', id: payment.userId };
  }
}
```

## Running Phase 2

### Quick Start

```bash
./run-phase2.sh
```

This starts:
1. Payment Subgraph on port 4001
2. User Subgraph on port 4002
3. SuperGraph Gateway on port 4000

### Manual Start

```bash
# Terminal 1: Payment Subgraph
cd shared-graphql
npm install && npm run build
PORT=4001 npm run start:subgraph

# Terminal 2: User Subgraph
cd user-subgraph
npm install && npm run build
PORT=4002 npm start

# Terminal 3: Gateway
cd gateway
npm install && npm run build
npm start
```

### Docker Compose

```bash
docker-compose -f docker-compose.phase2.yml up
```

## Demo Queries

### Query 1: Cross-Subgraph Join

```graphql
query UserWithPayments {
  user(id: "user-1") {
    id
    name
    email
    # This field resolved in Payment subgraph!
    payments {
      id
      amount
      currency
      status
    }
  }
}
```

The Gateway automatically:
1. Fetches user from User subgraph
2. Fetches payments for that user from Payment subgraph
3. Combines results into single response

### Query 2: Payment with User

```graphql
query PaymentWithUser {
  payment(id: "p_123") {
    id
    amount
    # This reference resolved in User subgraph!
    user {
      name
      email
    }
  }
}
```

### Query 3: Create Payment

```graphql
mutation CreatePayment {
  createPayment(input: {
    amount: 100.50
    currency: "USD"
    fromAccount: "acc-123"
    toAccount: "acc-456"
    userId: "user-1"
  }) {
    success
    paymentId
    reason
  }
}
```

## Running Demo Client

```bash
cd gateway
npx ts-node demo-client.ts
```

This demonstrates:
- Cross-subgraph queries
- Entity resolution
- Mutations through gateway
- Automatic query planning

## Benefits of Phase 2

### 1. Single Entry Point
- Clients only need to know one endpoint
- Gateway handles routing to subgraphs
- Simplified client configuration

### 2. Independent Deployment
- Subgraphs can be deployed separately
- No tight coupling through shared npm package
- Each service manages own database/resources

### 3. Team Autonomy
- Payment team owns Payment subgraph
- User team owns User subgraph
- Teams deploy independently

### 4. Scalability
- Scale subgraphs independently based on load
- Payment subgraph can have 10 instances
- User subgraph can have 3 instances

### 5. Type Safety Across Services
- Gateway validates queries across all subgraphs
- Compiler ensures entity contracts are met
- Breaking changes detected at composition time

## Migration Path

### What Stayed the Same
- ✅ Business logic (PaymentService, UserService)
- ✅ SOLID principles and OOP patterns
- ✅ Port/Adapter architecture
- ✅ Dependency injection

### What Changed
- 🔄 Shared library → Independent subgraph services
- 🔄 Direct imports → Network calls via Gateway
- 🔄 Single Apollo Server → Gateway + Subgraphs
- 🔄 Local resolvers → Federated entity resolvers

## Endpoints

| Service | Port | URL |
|---------|------|-----|
| Gateway | 4000 | http://localhost:4000/graphql |
| Payment Subgraph | 4001 | http://localhost:4001/graphql |
| User Subgraph | 4002 | http://localhost:4002/graphql |

## Next Steps

1. **Add More Subgraphs**: Order, Product, Inventory
2. **Implement DataLoader**: Batch entity resolution
3. **Add Authentication**: JWT validation at gateway
4. **Monitoring**: Distributed tracing, metrics
5. **Production Gateway**: Use Apollo Router (Rust-based)
6. **Schema Registry**: Apollo Studio for managed federation

## Troubleshooting

### Gateway Won't Start
- Ensure both subgraphs are running first
- Check subgraph URLs in gateway/src/index.ts

### Entity Resolution Fails
- Verify @key directives match
- Check __resolveReference implementation
- Ensure entity IDs are consistent

### Schema Composition Errors
- Run subgraphs standalone to test schemas
- Use `rover subgraph check` for validation
- Check @external fields are marked correctly

## Resources

- [Apollo Federation Docs](https://www.apollographql.com/docs/federation/)
- [Entity Reference Resolution](https://www.apollographql.com/docs/federation/entities/)
- [SuperGraphPlan.md](./SuperGraphPlan.md) - Migration guide
