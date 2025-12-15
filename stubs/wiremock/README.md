WireMock stubs for the project.

Start WireMock locally (from repo root):

```bash
cd stubs/wiremock
docker compose up -d
# confirm
curl http://localhost:8080/__admin/mappings
```

Mappings are under `mappings/`. The service endpoints used by tests:
- POST /payments/authorize
- POST /payments/capture
- POST /payments/refund
