"""FastAPI application factory and wiring."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.logging import configure_logging, new_request_id, request_id_ctx
from app.database import Base, engine
from app.routers import admin, auth, cart, catalog, go, lists, share, upload

log = logging.getLogger("app")
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging(json_logs=settings.is_prod)
    if settings.AUTO_CREATE_TABLES:
        Base.metadata.create_all(bind=engine)
    if settings.SEED_ON_STARTUP:
        try:
            from app.seed import run as seed_run
            seed_run()
        except Exception as exc:  # noqa: BLE001
            log.warning("Seed on startup skipped", exc_info=exc)
    log.info("API started", extra={"extra_fields": {"env": settings.ENV}})
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="2.0.0",
    description="Backend do Instrumenta — padroniza listas de materiais e otimiza compras nas dentais.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)
app.state.limiter = limiter

# -- Middleware --------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    rid = request.headers.get("x-request-id") or new_request_id()
    request_id_ctx.set(rid)
    response = await call_next(request)
    response.headers["x-request-id"] = rid
    return response


# -- Exception handlers (consistent error envelope) --------------------
def _error(status_code: int, message: str, detail=None):
    body = {"error": {"message": message, "request_id": request_id_ctx.get()}}
    if detail is not None:
        body["error"]["detail"] = detail
    return JSONResponse(status_code=status_code, content=body)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    return _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "Dados inválidos.", exc.errors())


@app.exception_handler(RateLimitExceeded)
async def ratelimit_handler(request: Request, exc: RateLimitExceeded):
    return _error(status.HTTP_429_TOO_MANY_REQUESTS, "Muitas requisições. Tente novamente em instantes.")


@app.exception_handler(Exception)
async def unhandled_handler(request: Request, exc: Exception):
    log.exception("Unhandled error")
    return _error(status.HTTP_500_INTERNAL_SERVER_ERROR, "Erro interno.")


# -- Health ------------------------------------------------------------
@app.get("/", tags=["Health"])
def root():
    return {"service": settings.APP_NAME, "status": "ok"}


@app.get("/health", tags=["Health"])
def health():
    """Readiness probe — verifies DB (and Redis if reachable)."""
    checks = {"database": "ok"}
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        checks["database"] = "down"
    try:
        import redis
        redis.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=1).ping()
        checks["redis"] = "ok"
    except Exception:  # noqa: BLE001
        checks["redis"] = "down"
    healthy = checks["database"] == "ok"
    return JSONResponse(status_code=200 if healthy else 503,
                        content={"status": "ok" if healthy else "degraded", "checks": checks})


# -- Routers (versioned) -----------------------------------------------
for r in (auth.router, upload.router, lists.router, cart.router,
          catalog.router, share.router, go.router, admin.router):
    app.include_router(r, prefix=settings.API_PREFIX)
