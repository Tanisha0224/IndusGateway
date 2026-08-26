# Proposed Backend API Contract — IndusGate AI

This document proposes the REST API surface the backend team should implement to replace the mock
service layer in `src/lib/store.ts`. Routes are illustrative; adjust to your API-gateway and versioning
conventions. All routes are prefixed `https://gateway.indusgate.example/v1` (placeholder domain).

Conventions: all mutating endpoints require a valid session token (admin UI) or virtual key
(`/chat/completions` only). All list endpoints support `?page`, `?pageSize`, and relevant filters.
Errors follow `{ "error": { "code": string, "message": string } }` with standard HTTP status codes.

## Authentication

| Method | Route | Purpose | Key request fields | Key response fields | Common errors |
|---|---|---|---|---|---|
| POST | `/auth/session` | Authenticate an admin-UI user | `email`, `password` | `token`, `user` | 401 invalid credentials |
| POST | `/auth/logout` | Invalidate the current session | — | — | 401 |
| GET | `/auth/me` | Fetch the current session's user + role | — | `user`, `role`, `permissions` | 401 |

## Organisations, Departments, Teams, Projects

| Method | Route | Purpose | Key fields | Errors |
|---|---|---|---|---|
| GET | `/organisations/{id}` | Fetch org + nested departments/teams/projects | — | 404 |
| POST | `/departments` | Create a department | `orgId`, `name`, `code` | 403, 422 |
| POST | `/teams` | Create a team | `departmentId`, `name` | 403, 422 |
| POST | `/projects` | Create a project | `teamId`, `name`, `monthlyBudgetUsd` | 403, 422 |
| PATCH | `/projects/{id}` | Update a project (status, budget) | partial fields | 403, 404 |

## Users & Roles

| Method | Route | Purpose | Key fields | Errors |
|---|---|---|---|---|
| GET | `/users` | List users with role and department | filters | 403 |
| POST | `/users/{id}/role` | Change a user's role | `role` | 403, 404, 422 |

## Providers & Models

| Method | Route | Purpose | Key fields | Errors |
|---|---|---|---|---|
| GET | `/providers` | List providers/models with health, cost, sovereignty | filters | — |
| GET | `/providers/{modelId}` | Model detail | — | 404 |
| PATCH | `/providers/{modelId}` | Update position (default/backup), allowed use cases | — | 403, 404 |
| GET | `/providers/health` | Current health snapshot for all models | — | — |
| POST | `/providers/{modelId}/simulate-failure` | **Demo/staging only** — force unhealthy state | — | 403 in production |

## Model Aliases

| Method | Route | Purpose | Key fields | Errors |
|---|---|---|---|---|
| GET | `/aliases` | List aliases | — | — |
| POST | `/aliases` | Create alias | `name`, `primaryModelId`, `fallbackModelIds`, `sensitiveDataOnly` | 403, 422 (name collision / format) |
| PATCH | `/aliases/{id}` | Update alias | partial fields | 403, 404 |
| DELETE | `/aliases/{id}` | Delete alias (if unused by active keys) | — | 403, 404, 409 |

## Routing Policies

| Method | Route | Purpose | Key fields | Errors |
|---|---|---|---|---|
| GET | `/routing-policies` | List policies ordered by priority | — | — |
| POST | `/routing-policies` | Create policy | `name`, `strategy`, `plainLanguage`, `fallbackChain`, `priority`, scope fields | 403, 422 |
| PATCH | `/routing-policies/{id}` | Update / enable / disable | partial fields | 403, 404 |
| DELETE | `/routing-policies/{id}` | Delete policy | — | 403, 404 |

## Budgets & Rate Limits

| Method | Route | Purpose | Key fields | Errors |
|---|---|---|---|---|
| GET | `/budgets` | List budget policies by scope | filters | — |
| PUT | `/budgets/{id}` | Update monthly limit / thresholds | `monthlyLimitUsd`, `softWarningPct`, `hardStopPct` | 403, 404, 422 |
| GET | `/rate-limits` | List rate-limit policies | filters | — |
| PUT | `/rate-limits/{id}` | Update RPM/TPM/daily cap/burst | partial fields | 403, 404 |

## PII Policies

| Method | Route | Purpose | Key fields | Errors |
|---|---|---|---|---|
| GET | `/pii-policies` | Fetch configured PII categories and masking rules | — | — |
| PUT | `/pii-policies` | Update detection categories / masking behaviour | `categories[]`, `maskingStrategy` | 403, 422 |

## Virtual Keys

| Method | Route | Purpose | Key fields | Errors |
|---|---|---|---|---|
| GET | `/keys` | List keys with filters (status, project, env) | — | — |
| POST | `/keys` | Create a key — returns full secret **once** | `name`, `environment`, `projectId`, `allowedAliasIds`, `budgetLimitUsd`, `rateLimitRpm`, `ipRestrictions`, `expiresAt` | 403, 422 |
| POST | `/keys/{id}/rotate` | Rotate secret — returns new full secret **once** | — | 403, 404, 409 (already revoked) |
| POST | `/keys/{id}/revoke` | Revoke immediately | — | 403, 404 |
| DELETE | `/keys/{id}` | Delete a revoked key's record | — | 403, 404, 409 (not revoked) |
| GET | `/keys/{id}/activity` | Key activity history | — | 404 |

## Chat Completions (core gateway call)

| Method | Route | Purpose | Key fields | Errors |
|---|---|---|---|---|
| POST | `/chat/completions` | OpenAI-compatible completion via a virtual key | `model` (alias), `messages[]`, `temperature`, `max_tokens`, `stream` | 401 (invalid/revoked/expired key), 402/429 (budget/rate limit), 403 (policy block), 502 (provider failure) |

Response includes standard OpenAI-compatible fields plus gateway extensions: `x-indusgate-trace-id`,
`x-indusgate-route-sovereignty`, `x-indusgate-egress-status`, `x-indusgate-cache-status` response headers (or
equivalent body fields, per team preference).

## Request Traces

| Method | Route | Purpose | Key fields | Errors |
|---|---|---|---|---|
| GET | `/traces` | List traces with filters (outcome, sovereignty, project, key) | — | — |
| GET | `/traces/{traceId}` | Full stage-by-stage trace | — | 404 |

## Audit Logs

| Method | Route | Purpose | Key fields | Errors |
|---|---|---|---|---|
| GET | `/audit-events` | Query audit records | filters (actor, project, result, date range) | — |
| GET | `/audit-events/{id}` | Single event with integrity verification | — | 404 |

## Cache

| Method | Route | Purpose | Key fields | Errors |
|---|---|---|---|---|
| GET | `/cache/entries` | List cache entries by project | filters | — |
| DELETE | `/cache/entries/{id}` | Invalidate one entry | — | 404 |
| DELETE | `/cache` | Clear all entries (scoped by project if provided) | `projectId?` | 403 |

## Usage & Billing

| Method | Route | Purpose | Key fields | Errors |
|---|---|---|---|---|
| GET | `/usage` | Aggregated usage by org/department/project/key/provider/model | filters, date range | — |
| GET | `/billing/summary` | Spend, forecast, savings estimates | date range | — |
| GET | `/billing/export` | CSV/PDF export | format, filters | — |

## Alerts

| Method | Route | Purpose | Key fields | Errors |
|---|---|---|---|---|
| GET | `/alerts` | List alerts | filters | — |
| POST | `/alerts/{id}/read` | Mark as read | — | 404 |
| POST | `/alerts/read-all` | Mark all as read | — | — |
