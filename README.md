# IndusGate AI Sentinel Prototype

IndusGate AI Sentinel is a full-stack prototype of a secure, OpenAI-compatible enterprise AI gateway. It demonstrates how an organization can centralize LLM access while enforcing privacy controls, provider governance, model routing, budget limits, semantic caching, and auditability.

The app is designed for hackathon/demo evaluation: it runs locally, includes seeded enterprise data, persists state to PostgreSQL when available, and ships with a local demo provider so the gateway can be demonstrated without real OpenAI/Gemini credentials.

## What It Demonstrates

- OpenAI-compatible gateway endpoints: `/v1/models`, `/v1/chat/completions`, `/v1/embeddings`
- Public model aliases that hide provider-specific model names
- Provider registry with encrypted credential storage metadata
- Local demo provider for reliable offline walkthroughs
- Policy-aware routing with India-only, protected external, and fallback behavior
- Deterministic PII detection, masking, blocking, and response scanning
- Buffered privacy streaming for `stream: true` chat completions
- Budget and rate-limit governance with request reservation and settlement traces
- Project-scoped semantic cache with cache hit/miss trace evidence
- Request trace drawer showing privacy, routing, provider, governance, and cache decisions
- Admin user management with roles, activation status, departments, teams, and project scope
- Audit logs, provider health, alerts, usage, and billing views
- Playwright demo recorder that generates a captioned walkthrough video

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Recharts, Zustand |
| Backend | FastAPI, Pydantic, SQLAlchemy 2, Uvicorn |
| Persistence | PostgreSQL preferred, SQLite development fallback |
| Testing | Pytest, FastAPI TestClient, Playwright for demo recording |
| Gateway Shape | OpenAI-compatible request/response contracts |

## Repository Structure

```text
backend/
  app/
    api/                 OpenAI-compatible route adapters
    core/                settings, authentication, OpenAI-style errors
    db/                  SQLAlchemy session and snapshot persistence
    repositories/        persisted state repository
    schemas/             OpenAI-compatible request schemas
    services/            gateway, routing, privacy, cache, health, providers
    store.py             seeded state plus persisted snapshot boundary
  tests/                 backend regression tests
  requirements.txt
  db_schema.sql

frontend/
  src/
    components/          app shell and UI primitives
    lib/api/             typed backend API clients
    pages/               dashboard, providers, cache, traces, playground, etc.
    types/               frontend domain types
  package.json

scripts/
  record-demo-walkthrough.mjs
```

## Demo Login

Use the Platform Admin account for the complete walkthrough:

```text
Email:    platform.admin@indusgate.example
Password: demo123
```

Other seeded users include developer, auditor, billing viewer, organization admin, department manager, and read-only viewer roles.

## Reliable Gateway Demo

The seeded demo route works without any external provider credentials:

```text
Virtual key: ig_sk_test_demo_secret
Model alias: indusgate-demo
```

Send the same prompt twice from the Playground:

1. First request: provider call succeeds with `cache: miss`
2. Second request: same prompt returns with `cache: hit` and trace shows provider call saved

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Health check:

```bash
curl http://127.0.0.1:8000/ready
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open the printed local URL, usually:

```text
http://127.0.0.1:5173
```

If port `5173` is busy, Vite may use `5174`. The backend CORS allowlist includes both ports for local demo use.

## PostgreSQL Setup

The backend reads `DATABASE_URL` from `backend/.env`.

Example:

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/sentinel
```

Create the snapshot table and seed only when empty:

```bash
cd backend
python -m app.db.seed_state --create-state-table
```

If PostgreSQL is unavailable in development, the app falls back to SQLite via `DEVELOPMENT_DATABASE_URL`.

## Environment Variables

Start from:

```text
backend/.env.example
```

Important variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Primary PostgreSQL connection string |
| `DEVELOPMENT_DATABASE_URL` | SQLite fallback for local development |
| `JWT_SECRET` | Demo session signing secret |
| `ENCRYPTION_KEY` | Fernet key for provider credential encryption |
| `OPENAI_API_KEY` | Optional real OpenAI provider key |
| `INDIA_HOSTED_LLM_API_KEY` | Optional India-hosted/vLLM provider key |
| `GEMINI_API_KEY` | Optional Gemini provider key |
| `REDIS_URL` | Optional rate-limit backend |

Never commit real `.env` files or provider API keys.

## API Examples

List visible model aliases for a virtual key:

```bash
curl http://127.0.0.1:8000/v1/models \
  -H "Authorization: Bearer ig_sk_test_demo_secret"
```

Send a demo chat completion:

```bash
curl http://127.0.0.1:8000/v1/chat/completions \
  -H "Authorization: Bearer ig_sk_test_demo_secret" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "indusgate-demo",
    "messages": [
      { "role": "user", "content": "Summarize gateway privacy controls for an internal review." }
    ]
  }'
```

Inspect cache entries after signing in through the UI:

```bash
curl http://127.0.0.1:8000/api/cache/entries
```

## Demo Video

Generate a captioned walkthrough video:

```bash
node scripts/record-demo-walkthrough.mjs
```

Output:

```text
demo-recording/indusgate-demo-walkthrough.webm
```

Generated recordings are ignored by Git because they are build artifacts.

## Verification

Backend:

```bash
python -m compileall backend/app
python -m pytest backend/tests -q
```

Frontend:

```bash
cd frontend
npm run build
```

Current verified status:

```text
Backend tests: 43 passed
Frontend build: passed
Demo provider: working
Semantic cache: miss then hit verified
```

## Security Notes

This is a prototype, not a production gateway. It demonstrates security architecture and control flow, but production deployment would still need:

- real SSO/OIDC integration
- hardened session lifecycle and CSRF controls
- per-tenant authorization boundaries
- durable normalized database schema instead of snapshot persistence
- Redis-backed distributed rate limiting
- production-grade semantic embeddings/vector store
- encrypted audit log integrity controls
- provider-specific billing reconciliation
- deployment secrets management
- CI/CD and infrastructure-as-code

## Suggested Demo Flow

1. Sign in as Platform Admin.
2. Open Dashboard and show live backend KPIs.
3. Open Organisation & Access and show user/role management.
4. Open Providers and point out Local Demo Provider plus external providers.
5. Open Model Aliases and explain stable public model names.
6. Open Privacy Policies and simulate sensitive data handling.
7. Open Routing Policies and show India-only/protected routing.
8. Open Budgets & Rate Limits and show governance controls.
9. Open Virtual Keys and explain scoped gateway access.
10. Open Playground, use `ig_sk_test_demo_secret` and `indusgate-demo`.
11. Send the same prompt twice to show cache miss then cache hit.
12. Open Semantic Cache and Request Traces to inspect evidence.
13. Close with Audit Logs, Provider Health, Billing, Docs, and Alerts.

## License

This repository is currently shared as a prototype/hackathon project. Add a license before public production use.
