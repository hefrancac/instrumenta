"""Database engine, session factory, and declarative Base."""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings


def _normalize_db_url(url: str) -> str:
    """Aceita as URLs que provedores gerenciados (Render/Heroku) entregam.

    - ``postgres://``  -> ``postgresql+psycopg2://`` (o SQLAlchemy moderno rejeita o alias antigo)
    - ``postgresql://`` -> ``postgresql+psycopg2://`` (fixa o driver explicitamente)
    """
    if url.startswith("postgres://"):
        return "postgresql+psycopg2://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg2://" + url[len("postgresql://"):]
    return url


DATABASE_URL = _normalize_db_url(settings.DATABASE_URL)

# SQLite (used by the test-suite) needs a special connect arg; Postgres benefits
# from pool_pre_ping to survive dropped connections.
_is_sqlite = DATABASE_URL.startswith("sqlite")
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=not _is_sqlite,
    pool_size=10 if not _is_sqlite else 5,
    max_overflow=20 if not _is_sqlite else 0,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    future=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()


def get_db():
    """FastAPI dependency yielding a request-scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
