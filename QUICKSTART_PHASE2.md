# 🚀 Phase 2 Quick Start Guide

## Prerequisites

```bash
node --version  # Requires Node 18+
npm --version   # Requires npm 8+
```

## Installation & Startup

### Option 1: Automated Script (Recommended)

```bash
./run-phase2.sh
```

This automatically:
1. Installs all dependencies
2. Builds TypeScript projects  
3. Starts all services in correct order
4. Shows you available endpoints

### Option 2: Manual Startup

```bash
# 1. Install dependencies
cd shared-graphql && npm install
cd ../user-subgraph && npm install
cd ../gateway && npm install

# 2. Build projects
cd ../shared-graphql && npm run build
cd ../user-subgraph && npm run build
cd ../gateway && npm run build

# 3. Start services (each in separate terminal)

# Terminal 1: Payment Subgraph
cd shared-graphql
PORT=4001 npm run start:subgraph

# Terminal 2: User Subgraph
cd user-subgraph
PORT=4002 npm start

# Terminal 3: Gateway
cd gateway
npm start
```

## Verify Installation

Once running, you should see:

```
🚀 Payment Subgraph ready at http://localhost:4001/graphql
🚀 User Subgraph ready at http://localhost:4002/graphql
🚀 SuperGraph Gateway ready at http://localhost:4000/graphql
```

## Test with Demo Client

```bash
cd gateway
npx ts-node demo-client.ts
```

Expected output:
```
📊 Demo 1: Cross-Subgraph Query (User + Payments)
Result: {
  "user": {
    "id": "user-1",
    "name": "Alice Johnson",
    "payments": [...]
  }
}
✅ Gateway automatically composed data from both subgraphs!
```

## Manual GraphQL Queries

### Using GraphQL Playground

Open in browser: http://localhost:4000/graphql

### Using curl

```bash
# Query user with payments (cross-subgraph)
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { user(id: \"user-1\") { name email payments { amount currency } } }"
  }'

# Create payment
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { createPayment(input: { amount: 100.50, currency: \"USD\", fromAccount: \"acc-123\", toAccount: \"acc-456\", userId: \"user-1\" }) { success paymentId } }"
  }'
```

## Docker Compose (Alternative)

```bash
docker-compose -f docker-compose.phase2.yml up
```

Note: Requires Docker and Docker Compose installed.

## Troubleshooting

### Gateway fails to start

**Problem:** `ECONNREFUSED` errors

**Solution:** Ensure subgraphs are running first
```bash
# Check if subgraphs are up
curl http://localhost:4001/graphql
curl http://localhost:4002/graphql
```

### Port already in use

**Problem:** `EADDRINUSE: address already in use :::4000`

**Solution:** Kill existing processes
```bash
lsof -ti:4000 | xargs kill -9
lsof -ti:4001 | xargs kill -9
lsof -ti:4002 | xargs kill -9
```

### TypeScript build errors

**Problem:** `Cannot find module '@apollo/subgraph'`

**Solution:** Reinstall dependencies
```bash
cd shared-graphql
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Gateway composition errors

**Problem:** `Error: Unknown type "User"`

**Solution:** Ensure both subgraphs are running and schemas are valid
```bash
# Test subgraph schemas directly
curl http://localhost:4001/graphql -d '{"query":"{ __schema { types { name } } }"}'
curl http://localhost:4002/graphql -d '{"query":"{ __schema { types { name } } }"}'
```

## Next Steps

1. ✅ **Explore the code**
   - [gateway/src/index.ts](gateway/src/index.ts) - Gateway configuration
   - [shared-graphql/src/subgraph-server.ts](shared-graphql/src/subgraph-server.ts) - Payment subgraph
   - [user-subgraph/src/index.ts](user-subgraph/src/index.ts) - User subgraph

2. ✅ **Read the docs**
   - [PHASE2_GUIDE.md](PHASE2_GUIDE.md) - Comprehensive guide
   - [PHASE_COMPARISON.md](PHASE_COMPARISON.md) - Phase 1 vs Phase 2
   - [SuperGraphPlan.md](SuperGraphPlan.md) - Migration details

3. ✅ **Try queries**
   - Open GraphQL Playground: http://localhost:4000/graphql
   - Run demo client: `cd gateway && npx ts-node demo-client.ts`
   - Use curl examples above

4. ✅ **Compare with Phase 1**
   ```bash
   git checkout main
   ./run-all.sh
   ```

## Architecture Overview

```
┌──────────────┐
│   Clients    │ (Single endpoint: http://localhost:4000/graphql)
└──────┬───────┘
       │
┌──────▼────────────────┐
│  SuperGraph Gateway   │ (Port 4000)
│  - Query Planning     │
│  - Entity Resolution  │
└──────┬───────┬────────┘
       │       │
   ┌───▼───┐ ┌▼─────────┐
   │Payment│ │   User   │
   │(4001) │ │  (4002)  │
   └───────┘ └──────────┘
```

## Key Features Demonstrated

- ✅ **Single Gateway Endpoint** - One URL for all queries
- ✅ **Cross-Subgraph Queries** - Query User + Payments in single request
- ✅ **Entity Resolution** - Automatic @key-based reference resolution
- ✅ **Independent Services** - Each subgraph deployed separately
- ✅ **Type Safety** - Federation validates entity contracts
- ✅ **Query Planning** - Gateway optimizes execution across subgraphs

## Support

For issues or questions:
1. Check [PHASE2_GUIDE.md](PHASE2_GUIDE.md) troubleshooting section
2. Review [SuperGraphPlan.md](SuperGraphPlan.md) for architecture details
3. Compare with [PHASE_COMPARISON.md](PHASE_COMPARISON.md) to understand differences

---

**Ready to explore?** Start with: `./run-phase2.sh` 🚀
