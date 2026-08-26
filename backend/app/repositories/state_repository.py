from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.models.state import AppStateSnapshot


STATE_NAME = "production"


class StateRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, name: str = STATE_NAME) -> dict[str, Any] | None:
        row = self.session.get(AppStateSnapshot, name)
        if row is None:
            return None
        return dict(row.payload)

    def save(self, payload: dict[str, Any], name: str = STATE_NAME) -> None:
        row = self.session.get(AppStateSnapshot, name)
        if row is None:
            row = AppStateSnapshot(name=name, payload=payload)
            self.session.add(row)
        else:
            row.payload = payload
            row.updated_at = datetime.now(timezone.utc)

    def table_available(self) -> bool:
        try:
            self.session.execute(select(AppStateSnapshot.name).limit(1)).first()
            return True
        except SQLAlchemyError:
            self.session.rollback()
            return False
