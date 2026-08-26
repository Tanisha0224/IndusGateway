# IndusGate AI Backend

FastAPI backend for the IndusGate AI prototype.

## Implemented

- Cookie-based admin login/logout with seeded demo users.
- Project, policy, provider, virtual-key, trace, audit-log and usage APIs.
- OpenAI-compatible `/v1/models`, `/v1/chat/completions` and `/v1/embeddings`.
- Backend-enforced public model aliases with internal provider-model targets.
- Backend-enforced routing policies with deterministic priority ordering and deny-biased restrictions.
- Routing simulation that returns matched policies, effective restrictions, eligible targets and excluded targets without calling a provider.
- Gateway traces include public alias, selected target/provider, matched policies, sovereignty decision, egress decision, attempts, fallback usage and sanitized provider failure categories.
- Optional PostgreSQL-backed state persistence using SQLAlchemy 2.x, with a sanitized snapshot repository that avoids raw API key and session-token storage.
- `/ready` checks database connectivity and whether the persistence table is available.
- Policy-driven PII privacy firewall for chat completions and embeddings. The deterministic engine detects synthetic/test PII categories such as email, Indian mobile, PAN, Aadhaar, GSTIN, card, bank account, IFSC, UPI, passport, IP addresses, API keys and JWTs; it masks or blocks before provider routing and records safe privacy metadata only.

## Storage Boundary

The API still exposes the existing dictionary-shaped contracts used by the frontend, but production state can now be loaded from and saved to PostgreSQL through:

- `app/db/session.py`
- `app/db/models/state.py`
- `app/repositories/state_repository.py`

Alembic migrations are intentionally skipped in this phase. To bootstrap a local database without resetting any existing data:

```bash
python -m app.db.seed_state --create-state-table
```

That command runs `db_schema.sql` with `create table if not exists` and seeds the current IndusGate AI state only when the snapshot row does not already exist.

Browser sessions are not persisted. Virtual key plaintext values are not persisted; only SHA-256 token hashes are stored in the state snapshot for lookup after restart.

## Privacy Firewall

Privacy protection defaults to enabled with fail-closed behavior:

```bash
PII_PROTECTION_ENABLED=true
PII_FAIL_MODE=closed
PII_ENGINE=deterministic
PII_MAX_TEXT_CHARACTERS=100000
PII_RESPONSE_SCAN_ENABLED=true
PII_ALLOW_RESTORATION=false
PII_STORE_SANITIZED_CONTENT=false
PII_LOG_CONTENT=false
```

The backend does not install or require Presidio in this phase; no NER-based name or address detection is claimed. Restoration is intentionally disabled by default. Request traces and audit logs store entity types, counts, decisions, policy IDs and detector version, not raw sensitive values or reversible mappings.

### Secure Buffered Streaming

Streaming chat completions use buffered privacy mode when `stream: true`. IndusGate AI collects provider SSE chunks internally, assembles the complete assistant response and tool-call arguments, scans and masks or blocks sensitive output, then emits fresh OpenAI-compatible SSE chunks using the public IndusGate alias. This intentionally increases time to first response; raw provider chunks are never forwarded directly to clients.

Streaming privacy is fail-closed:

```bash
STREAMING_PRIVACY_ENABLED=true
STREAMING_PRIVACY_MODE=buffered
STREAMING_FAIL_MODE=closed
STREAMING_MAX_BUFFER_CHARACTERS=200000
STREAMING_MAX_EVENT_BYTES=1048576
STREAMING_PROVIDER_TIMEOUT_SECONDS=120
STREAMING_OUTPUT_CHUNK_CHARACTERS=256
```

Client disconnect tracking is represented in trace fields, but because buffered mode scans before response emission, most provider buffering completes before the client receives SSE bytes.

## Verification

```bash
python -m compileall app tests
pytest -q
```
