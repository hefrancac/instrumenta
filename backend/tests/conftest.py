"""Shared pytest fixtures.

Runs the app against a temporary SQLite database with demo mode on and the mock
scraper, so the full HTTP surface is exercised without Postgres/Redis/LLM.
"""
import os
import tempfile

import pytest

# Configure the environment BEFORE the app imports settings.
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ.update(
    DATABASE_URL=f"sqlite:///{_tmp.name}",
    DEMO_MODE="true",
    SEED_ON_STARTUP="true",
    SCRAPER_MODE="mock",
    ANTHROPIC_API_KEY="",
    JWT_SECRET="test-secret",
)


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as c:   # triggers lifespan: create tables + seed
        yield c
    try:
        os.unlink(_tmp.name)
    except OSError:
        pass
