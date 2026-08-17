"""Idempotência para POSTs: a mesma X-Idempotency-Key devolve a mesma resposta.

Guarda a resposta serializada no Redis com TTL. Se o Redis estiver fora, degrada
graciosamente — a requisição segue normalmente, só sem a garantia de idempotência.
"""
from __future__ import annotations

import json
from typing import Optional

from app.core.config import settings

_client = None
_PREFIX = "idem:"
_TTL = 86_400  # 24h


def _redis():
    global _client
    if _client is None:
        import redis  # import tardio: não obriga o broker em testes
        _client = redis.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=1)
    return _client


def get_cached(key: Optional[str]) -> Optional[dict]:
    """Resposta já processada para esta chave, ou None."""
    if not key:
        return None
    try:
        raw = _redis().get(_PREFIX + key)
        return json.loads(raw) if raw else None
    except Exception:  # noqa: BLE001 — sem Redis: sem idempotência, mas não quebra
        return None


def store(key: Optional[str], payload: dict) -> None:
    """Memoriza a resposta desta chave (no-op se não houver chave ou Redis)."""
    if not key:
        return
    try:
        _redis().setex(_PREFIX + key, _TTL, json.dumps(payload, default=str))
    except Exception:  # noqa: BLE001
        pass
