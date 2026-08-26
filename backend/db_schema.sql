-- Optional schema bootstrap for local development when Alembic is being skipped.
-- Run this manually against the configured PostgreSQL database. It is idempotent
-- and does not drop or reset existing data.

create table if not exists app_state_snapshots (
    name varchar(80) primary key,
    payload jsonb not null,
    updated_at timestamptz not null default now()
);
