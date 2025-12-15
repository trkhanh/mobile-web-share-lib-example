# Mobile / Web Shared Payee Validation Example

This repository demonstrates a small, practical approach to sharing business logic (payee validation) between mobile and web BFFs.

Contents
- `shared-graphql/` — shared library with TypeScript types, pure business logic, a service factory, GraphQL typeDefs, and example/test runners.
- `mobile-bff/` — minimal Apollo server example that consumes the shared library and exposes mobile-specific fields.
- `web-bff/` — minimal Express + Apollo server example that consumes the shared library and exposes web-specific fields.

Quick Start (Ubuntu)

1) Install Node (recommended: nvm)

```bash
# install nvm (if not installed)
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.6/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install --lts
nvm use --lts
node -v && npm -v
```

Alternative (apt):

```bash
sudo apt update
sudo apt install -y nodejs npm
```

2) Run the shared library smoke tests and example

```bash
cd /home/kane/Workspaces/mobile-web-share-lib-example/shared-graphql
npm install
# run compiled smoke tests
npm run test:smoke
# run example demo (build + run)
npm run start:example
```

3) Start the example BFFs (each in a separate terminal)

```bash
cd /home/kane/Workspaces/mobile-web-share-lib-example/mobile-bff
npm install
node -r ts-node/register ./src/server.ts
# mobile BFF will listen on port 4001

cd /home/kane/Workspaces/mobile-web-share-lib-example/web-bff
npm install
node -r ts-node/register ./src/server.ts
# web BFF will listen on port 4002
```

4) Example GraphQL queries (curl)

Mobile BFF (port 4001):

```bash
curl -s -X POST http://localhost:4001/ \
  -H "Content-Type: application/json" \
  -d '{"query":"query($input: ValidatePayeeInput!){ validatePayee(input: $input) { isValid matchLevel confidence suggestedName } }","variables":{"input":{"accountNumber":"12345678","accountName":"Acme Corporation","bankCode":"010"}}}'
```

Web BFF (port 4002):

```bash
curl -s -X POST http://localhost:4002/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query($input: ValidatePayeeInput!){ validatePayee(input: $input) { isValid matchLevel confidence suggestedName validationId } }","variables":{"input":{"accountNumber":"11111111","accountName":"Jon Doe","bankCode":"020"}}}'
```

Notes & Next Steps
- The shared code currently imports via relative paths from the examples/BFFs (`../../shared-graphql/src/...`). For a real project, use a monorepo tool (npm workspaces, pnpm, or yarn workspaces) or publish the package and import by package name.
- The name similarity uses a Levenshtein ratio (implemented in `shared-graphql/src/resolvers/payee-resolvers.ts`). Replace with a library like `fast-levenshtein` or `talisman` if needed.
- I can add Jest tests, format/lint scripts, or convert the examples to use a proper monorepo setup. Tell me which you'd like next.

Files of interest
- `shared-graphql/src/types/payee.ts`
- `shared-graphql/src/resolvers/payee-resolvers.ts`
- `shared-graphql/src/services/payee-service.ts`
- `mobile-bff/src/server.ts`
- `web-bff/src/server.ts`

License: none included.

**ARCHITECTURE & DESIGN**

- **High level:** the `shared-graphql` package contains pure business logic, typed GraphQL schema/resolvers, and service composition (factories). BFFs (`mobile-bff`, `web-bff`) import and compose the shared package.
- **SOLID summary:**
  - **Single Responsibility:** modules are small and focused — e.g., resolvers adapt services, services orchestrate flows, infra modules handle persistence or HTTP only.
  - **Open/Closed:** behavior is extensible via dependency injection and replacement of implementations (provide different `IPaymentGateway`/`IPaymentStore`).
  - **Liskov Substitution:** implementations of ports (gateway/store/logger) should honor contracts so they can be substituted without changing caller logic.
  - **Interface Segregation:** ports expose small, focused interfaces (`IPaymentGateway`, `IPaymentStore`, `ILogger`).
  - **Dependency Inversion:** high-level services depend on abstractions; concrete implementations are provided at the composition boundary (`src/factories/service-factory.ts`).

- See `Architecture.md` at the repo root for a visual diagram (Mermaid) showing how `shared-graphql` components and consumers fit together.
