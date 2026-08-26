# Implemented Alias And Routing APIs

The current FastAPI prototype implements backend-enforced public model aliases, internal alias targets and routing policies.

## Model Aliases

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/model-aliases` | List public aliases with project/capability/status/sovereignty/search filters |
| POST | `/api/model-aliases` | Admin create alias |
| GET | `/api/model-aliases/{id}` | Fetch alias and targets |
| PATCH | `/api/model-aliases/{id}` | Admin update alias |
| DELETE | `/api/model-aliases/{id}` | Admin non-destructive disable |
| POST | `/api/model-aliases/{id}/enable` | Admin enable alias |
| POST | `/api/model-aliases/{id}/disable` | Admin disable alias |
| GET | `/api/model-aliases/{id}/targets` | List internal provider-model targets |
| POST | `/api/model-aliases/{id}/targets` | Admin create target |
| PATCH | `/api/model-aliases/{id}/targets/{target_id}` | Admin update target |
| DELETE | `/api/model-aliases/{id}/targets/{target_id}` | Admin non-destructive disable target |
| POST | `/api/model-aliases/{id}/targets/reorder` | Admin reorder targets |

## Routing Policies

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/routing-policies` | List backend-enforced routing policies |
| POST | `/api/routing-policies` | Admin create structured policy |
| GET | `/api/routing-policies/{id}` | Fetch policy |
| PATCH | `/api/routing-policies/{id}` | Admin update structured policy |
| DELETE | `/api/routing-policies/{id}` | Admin non-destructive disable |
| POST | `/api/routing-policies/{id}/enable` | Admin enable policy |
| POST | `/api/routing-policies/{id}/disable` | Admin disable policy |
| POST | `/api/routing-policies/simulate` | Evaluate routing without calling a provider |

## Gateway Behaviour

- `/v1/models` returns active public aliases allowed for the virtual key.
- Chat and embedding requests accept a public alias in `model`.
- Internal provider-model names are used only server-side.
- Responses return the public alias.
- Request traces include selected target/provider, matched routing policies, sovereignty mode, external-egress decision, attempt count, fallback usage and sanitized failure categories.

## Storage Note

The current repo has no SQLAlchemy model package and no Alembic script directory. These records are stored in `backend/app/store.py` for the running prototype and tests; PostgreSQL persistence remains a follow-up.
