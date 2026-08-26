# Routing Data Model Addendum

## ModelAlias

- `id`
- `project_id`
- `alias`
- `display_name`
- `description`
- `capability`: `chat` or `embedding`
- `status`: `active` or `disabled`
- `sovereignty_mode`: `india_only`, `protected_external` or `unrestricted`
- `fallback_enabled`
- `created_by`
- `created_at`
- `updated_at`

## AliasTarget

- `id`
- `model_alias_id`
- `provider_id`
- `provider_model_name`
- `priority`
- `enabled`
- `region`
- `is_india_hosted`
- `timeout_seconds`
- `max_retries`
- `fallback_eligible`
- `created_at`
- `updated_at`

## RoutingPolicy

- `id`
- `project_id`
- `name`
- `description`
- `priority`
- `enabled`
- `conditions_json`
- `actions_json`
- `created_by`
- `created_at`
- `updated_at`

`conditions_json` is structured by the backend and supports requested aliases, capabilities, virtual-key IDs and project IDs.

`actions_json` is structured by the backend and supports allowed/excluded providers, allowed regions, India-hosting requirement, external-egress decision, fallback decision, maximum timeout and maximum retries.

## GatewayRequest Routing Fields

- `requested_public_alias`
- `selected_alias_id`
- `selected_target_id`
- `selected_provider_id`
- `selected_provider_model`
- `matched_routing_policy_ids`
- `sovereignty_mode`
- `external_egress_allowed`
- `routing_reason`
- `attempt_count`
- `fallback_used`
- `attempted_targets`
- `provider_failure_categories`

## Storage Note

These fields are implemented in `backend/app/store.py` for the current running prototype. PostgreSQL persistence requires a future SQLAlchemy/Alembic layer because this repository currently has no SQLAlchemy model package and no Alembic script directory.
