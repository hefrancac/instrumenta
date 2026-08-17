"""Preços de marketplace (Mercado Livre).

Por enquanto expõe só um /probe de diagnóstico: obtém o token de app (client
credentials) e faz UMA busca síncrona, devolvendo o status cru — assim dá pra
saber se a API de busca do ML responde com o token do app ou bloqueia (403).
Se responder, este router evolui para a busca real (síncrona, sem worker).
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request

from fastapi import APIRouter

from worker.scrapers.mercadolivre import (
    _DEFAULT_UA, MercadoLivreScraper, app_token, parse_ml_results,
)

router = APIRouter(prefix="/prices", tags=["Prices"])


@router.get("/probe")
def probe(q: str = "espelho bucal"):
    """Diagnóstico do Mercado Livre: token de app + 1 busca síncrona."""
    out: dict = {"query": q, "has_token": False, "token_prefix": None,
                 "search_status": None, "raw_results": None,
                 "results_count": None, "sample": None, "error": None}
    try:
        token = app_token()
    except Exception as exc:  # noqa: BLE001
        out["error"] = f"token error: {type(exc).__name__}: {exc}"
        return out
    if not token:
        out["error"] = "sem token — ML_CLIENT_ID/ML_CLIENT_SECRET ausentes ou grant falhou"
        return out
    out["has_token"] = True
    out["token_prefix"] = str(token)[:6]

    scraper = MercadoLivreScraper()
    term = q if "odont" in q.lower() else f"{q} odontologico"
    req = urllib.request.Request(scraper._url(term), headers={
        "User-Agent": _DEFAULT_UA, "Accept": "application/json",
        "Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            out["search_status"] = getattr(r, "status", 200)
            data = json.loads(r.read().decode("utf-8"))
        raw = data.get("results") if isinstance(data, dict) else None
        out["raw_results"] = len(raw or [])
        offers = parse_ml_results(data, q)
        out["results_count"] = len(offers)
        out["sample"] = [{"title": o.title, "price": o.price,
                          "confidence": o.confidence, "url": o.url} for o in offers[:3]]
    except urllib.error.HTTPError as exc:
        out["search_status"] = exc.code
        try:
            out["error"] = exc.read().decode("utf-8")[:400]
        except Exception:  # noqa: BLE001
            out["error"] = f"HTTP {exc.code}"
    except Exception as exc:  # noqa: BLE001
        out["error"] = f"{type(exc).__name__}: {exc}"
    return out
