# Known Limitations, Mocked Behaviours & Next Steps

## Backend-Connected In This Prototype

- Authentication uses the FastAPI backend and an HTTP-only cookie session.
- Projects, policies, providers, virtual keys, gateway requests, audit logs and usage summary are backend-connected.
- Model aliases and routing policies are backend APIs and are enforced by the gateway request path.
- `/v1/models` returns public aliases only.
- Chat and embedding requests use public aliases while the provider receives internal provider-model names.
- Routing simulation is backend-backed and does not call providers or expose credentials.
- Request traces include routing decision fields such as public alias, selected target, matched policies, sovereignty mode, external-egress decision, attempts and fallback usage.

## Still In-Memory Or Simulated

- The backend currently stores state in `backend/app/store.py`. SQLAlchemy and Alembic dependencies exist, but this repository does not contain SQLAlchemy models or an Alembic script directory, so PostgreSQL persistence remains unimplemented.
- Provider health failures are still manually simulated from the frontend.
- Rate-limit enforcement remains illustrative and is not enforced in the gateway hot path.
- Semantic cache is still seeded/static frontend data.
- Alerts are frontend-state based.
- Organisation hierarchy remains seeded display data.
- Most dashboard metrics still come from seeded frontend data.
- Tests use a local mock OpenAI-compatible provider. Do not configure paid provider credentials for this prototype pass.

## Production Requirements

- Add real SQLAlchemy models, Alembic migrations and PostgreSQL-backed repositories.
- Move secrets into a real secret manager and store only credential references in routing/provider records.
- Add real rate-limit and budget counters in the request path.
- Add provider health polling and circuit breakers.
- Add a production PII/classification engine.
- Add tamper-evident audit-log signing or hash chaining.
- Replace seeded organisation and alert data with backend APIs.
