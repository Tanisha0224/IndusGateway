from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.db.models.state import AppStateSnapshot


_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None
_database_url_override: str | None = None


def get_database_url() -> str:
    return (_database_url_override or get_settings().database_url).strip()


def database_configured() -> bool:
    return bool(get_database_url())


def get_engine() -> Engine:
    global _engine, _session_factory
    if _engine is None:
        settings = get_settings()
        database_url = get_database_url()
        engine_kwargs: dict[str, object] = {"future": True, "pool_pre_ping": True}
        if database_url.startswith("sqlite"):
            engine_kwargs["connect_args"] = {"check_same_thread": False}
        else:
            engine_kwargs.update({
                "pool_size": settings.db_pool_size,
                "max_overflow": settings.db_max_overflow,
                "pool_timeout": settings.db_pool_timeout_seconds,
                "pool_recycle": settings.db_pool_recycle_seconds,
            })
        _engine = create_engine(
            database_url,
            **engine_kwargs,
        )
        _session_factory = sessionmaker(bind=_engine, autoflush=False, expire_on_commit=False, future=True)
    return _engine


def configure_database_url(database_url: str | None) -> None:
    global _engine, _session_factory, _database_url_override
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _session_factory = None
    _database_url_override = database_url.strip() if database_url else None


def get_session_factory() -> sessionmaker[Session]:
    if _session_factory is None:
        get_engine()
    assert _session_factory is not None
    return _session_factory


@contextmanager
def session_scope() -> Iterator[Session]:
    session = get_session_factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def verify_database() -> tuple[bool, str | None]:
    if not database_configured():
        return False, "DATABASE_URL is not configured"
    try:
        with get_engine().connect() as connection:
            connection.execute(text("select 1"))
        return True, None
    except SQLAlchemyError as exc:
        return False, exc.__class__.__name__


def ensure_database_schema() -> None:
    AppStateSnapshot.__table__.create(bind=get_engine(), checkfirst=True)
