#!/bin/bash

# ============================================================================
# Phase 2: SuperGraph with Apollo Federation
# ============================================================================

echo ""
echo "🌐 Starting Phase 2: SuperGraph Architecture"
echo "=============================================="
echo ""
echo "Architecture:"
echo "  Gateway (4000) ← Single entry point"
echo "  ├── Payment Subgraph (4001)"
echo "  └── User Subgraph (4002)"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
(cd shared-graphql && npm install) &
(cd user-subgraph && npm install) &
(cd gateway && npm install) &
wait
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Build projects
echo -e "${BLUE}🔨 Building TypeScript projects...${NC}"
(cd shared-graphql && npm run build) &
(cd user-subgraph && npm run build) &
(cd gateway && npm run build) &
wait
echo -e "${GREEN}✅ Build complete${NC}"
echo ""

# Start subgraphs in background
echo -e "${BLUE}🚀 Starting Payment Subgraph (port 4001)...${NC}"
cd shared-graphql && PORT=4001 npm run start:subgraph &
PAYMENT_PID=$!

echo -e "${BLUE}🚀 Starting User Subgraph (port 4002)...${NC}"
cd ../user-subgraph && PORT=4002 npm start &
USER_PID=$!

# Wait for subgraphs to be ready
echo ""
echo "⏳ Waiting for subgraphs to initialize..."
sleep 5

# Start gateway
echo -e "${BLUE}🌐 Starting SuperGraph Gateway (port 4000)...${NC}"
cd ../gateway && npm start &
GATEWAY_PID=$!

# Wait for gateway to be ready
sleep 5
echo ""
echo -e "${GREEN}✅ Phase 2 SuperGraph is running!${NC}"
echo ""
echo "🌐 Endpoints:"
echo "  Gateway:          http://localhost:4000/graphql"
echo "  Payment Subgraph: http://localhost:4001/graphql"
echo "  User Subgraph:    http://localhost:4002/graphql"
echo ""
echo "💡 Try the demo client:"
echo "   cd gateway && npx ts-node demo-client.ts"
echo ""
echo "🔍 Example cross-subgraph query:"
echo '   query {'
echo '     user(id: "user-1") {'
echo '       name'
echo '       payments {'
echo '         amount'
echo '         currency'
echo '       }'
echo '     }'
echo '   }'
echo ""
echo "Press Ctrl+C to stop all services"

# Trap Ctrl+C and cleanup
trap 'kill $PAYMENT_PID $USER_PID $GATEWAY_PID 2>/dev/null' EXIT

# Wait for user interrupt
wait
