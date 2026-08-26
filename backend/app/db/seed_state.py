from __future__ import annotations

import argparse
from pathlib import Path

from sqlalchemy import text

from app import store
from app.db.session import get_engine, session_scope
from app.repositories.state_repository import StateRepository


def create_state_table() -> None:
    schema = Path(__file__).resolve().parents[2] / "db_schema.sql"
    sql = schema.read_text(encoding="utf-8")
    with get_engine().begin() as connection:
        connection.execute(text(sql))


def seed_state() -> None:
    with session_scope() as session:
        repository = StateRepository(session)
        if repository.get() is None:
            repository.save(store.export_state())


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed IndusGate AI state into PostgreSQL.")
    parser.add_argument("--create-state-table", action="store_true", help="Create the app_state_snapshots table if it does not exist.")
    args = parser.parse_args()

    if args.create_state_table:
        create_state_table()
    seed_state()
    print("IndusGate AI database state is seeded.")


if __name__ == "__main__":
    main()
