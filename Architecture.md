**Architecture Diagram**

- **Diagram:** Architecture focusing on the `shared-graphql` library and its consumers.
- **How to render:** paste the Mermaid block into a Mermaid-enabled editor (VS Code Mermaid Preview, GitHub Markdown, or https://mermaid.live).

```mermaid
flowchart LR
  %% Shared library and internal structure
  subgraph shared-graphql ["shared-graphql (shared library)"]
    direction TB
    SF["Service Factory\ncreateServices()"]
    subgraph Infra ["infra"]
      direction LR
      CL["ConsoleLogger"]
      IM["InMemoryPaymentStore"]
      MG["MockGateway"]
      HG["HttpPaymentGateway"]
    end
    subgraph Ports ["ports (interfaces)"]
      direction LR
      ILogger["ILogger"]
      IPG["IPaymentGateway"]
      IPS["IPaymentStore"]
    end
    subgraph Services ["services"]
      direction TB
      PaymentService["PaymentService"]
      PayeeService["PayeeService"]
    end
    subgraph GraphQL ["graphql / resolvers / schema"]
      direction TB
      Schema["Schemas\npayee.ts, payment-schema.ts"]
      Resolvers["Resolvers\npayment-resolvers.ts, payee-resolvers.ts"]
      Factories["Factories\nservice-factory.ts"]
    end

    SF --> PaymentService
    SF --> CL
    SF --> IM
    SF --> MG
    SF --> HG

    PaymentService -->|implements| IPG
    PaymentService -->|stores| IPS
    PaymentService -->|logs| ILogger

    Resolvers --> PaymentService
    Schema --> Resolvers
    Factories --> SF
  end

  %% Consumers of the shared library
  subgraph Consumers
    direction TB
    WebBFF["web-bff"]
    MobileBFF["mobile-bff"]
    E2E["playwright-e2e tests"]
    Examples["shared-graphql/examples"]
  end

  WebBFF -->|imports schema & resolvers| Schema
  WebBFF -->|uses service API| PaymentService
  MobileBFF -->|imports schema & resolvers| Schema
  MobileBFF -->|uses service API| PaymentService
  E2E -->|tests flows against| WebBFF
  E2E -->|may use| Examples
  Examples -->|exercise| SF

  %% External systems & stub
  subgraph External
    direction TB
    PaymentAPI["External Payment Provider"]
    Wiremock["Wiremock Stub\n(USE_WIREMOCK=true)"]
  end

  %% Gateway relationships and selection logic
  HttpPaymentGateway -->|HTTP ->| PaymentAPI
  MockGateway -->|local simulated responses| PaymentService
  PaymentService -->|gateway calls via IPaymentGateway| IPG

  %% Env-driven wiring
  SF -.->|if USE_WIREMOCK=true ->| HttpPaymentGateway
  SF -.->|else ->| MockGateway
  Wiremock -->|mocks payment endpoints| HttpPaymentGateway
```

**Notes**
- **Key file:** `src/factories/service-factory.ts` wires logger, store, and gateway selection. It uses `USE_WIREMOCK` to pick `HttpPaymentGateway` vs `MockGateway`.
- **Consumers:** `web-bff` and `mobile-bff` import schemas/resolvers or call services exported by `shared-graphql`. `playwright-e2e` drives end-to-end tests against those BFFs and may call the examples in `shared-graphql/examples`.
- **Infra options:** `InMemoryPaymentStore` (local store), `MockGateway` (in-process stub), `HttpPaymentGateway` (talks to real provider or Wiremock).

**Rendering / Preview**
- VS Code: Install the "Markdown Preview Enhanced" or "Mermaid Markdown Syntax Highlighting" extensions and open `Architecture.md`, then use the preview.
- Online: Paste the mermaid block into https://mermaid.live to preview.
- CLI render (optional):

```bash
# render to PNG using mermaid-cli (npm)
npx @mermaid-js/mermaid-cli -i Architecture.md -o architecture.png
```

If you want I can also add a small SVG/PNG export script or commit a generated image into the repo.
