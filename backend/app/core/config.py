"""Application settings — typed, env-driven, single source of truth.

Nothing secret is hard-coded; everything comes from the environment (see
.env.example). Import the singleton `settings` everywhere.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # -- App -------------------------------------------------------------
    APP_NAME: str = "Instrumenta API"
    ENV: str = "dev"                     # dev | prod
    DEBUG: bool = True
    API_PREFIX: str = "/api/v1"

    # -- Infra -----------------------------------------------------------
    DATABASE_URL: str = "postgresql+psycopg2://admin:adminpassword@localhost:5432/dentalsaas"
    REDIS_URL: str = "redis://localhost:6379/0"

    # -- CORS ------------------------------------------------------------
    # Comma-separated list of allowed origins (your frontend URLs).
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # -- Auth ------------------------------------------------------------
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week
    # In demo mode, endpoints fall back to a shared demo user when no token is
    # supplied — lets the frontend work without a login screen. Turn OFF in prod.
    DEMO_MODE: bool = True
    ADMIN_API_TOKEN: str = ""   # required header for /admin when not in DEMO_MODE
    DEMO_USER_EMAIL: str = "demo@instrumenta.app"

    # -- AI (name standardization / OCR) --------------------------------
    ANTHROPIC_API_KEY: str | None = None
    # Set to a current model string from your Anthropic console. When no key is
    # configured the service falls back to the local keyword matcher.
    LLM_MODEL: str = "claude-sonnet-4-5"
    LLM_MAX_TOKENS: int = 2000

    # -- Marketplace (Mercado Livre) ------------------------------------
    # Real prices for ANY item (incl. those outside the demo catalog). Create a
    # free app at developers.mercadolivre.com.br and set either a direct token
    # or the client id/secret (client-credentials grant). No creds => ML is off.
    ML_CLIENT_ID: str | None = None
    ML_CLIENT_SECRET: str | None = None
    ML_ACCESS_TOKEN: str | None = None   # optional: paste a token directly
    ML_SITE: str = "MLB"                  # MLB = Brazil
    ML_MAX_RESULTS: int = 10
    ML_AFFILIATE_TAG: str | None = None

    # -- Scraping --------------------------------------------------------
    SCRAPER_MODE: str = "mock"           # mock | live | marketplace
    PROXY_URL: str | None = None         # e.g. http://user:pass@proxy:8000
    SCRAPE_RATE_LIMIT_SECONDS: float = 2.0
    SCRAPER_USER_AGENT: str = "InstrumentaBot/1.0 (+https://instrumenta.app; contato@instrumenta.app)"
    SCRAPE_TIMEOUT_MS: int = 20000
    CACHE_TTL_HOURS: int = 24            # re-scrape only when cache is older

    # -- Uploads ---------------------------------------------------------
    MAX_UPLOAD_MB: int = 8

    # -- Lifecycle -------------------------------------------------------
    AUTO_CREATE_TABLES: bool = True      # dev convenience; use Alembic in prod
    SEED_ON_STARTUP: bool = True         # seed demo catalog if empty

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024

    @property
    def is_prod(self) -> bool:
        return self.ENV.lower() in {"prod", "production"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
