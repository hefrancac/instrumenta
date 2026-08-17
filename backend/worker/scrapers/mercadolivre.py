"""Mercado Livre — marketplace price source (real listings for ANY item).

Unlike the dental VTEX scrapers, this does not gate results on the fixed catalog:
it searches Mercado Livre for the item's query text and returns the best-matching
real listing, so items outside the demo catalog ("a buscar") get real prices too.

Auth: Mercado Livre requires an OAuth token on the search endpoint. Provide
``ML_ACCESS_TOKEN`` directly, or ``ML_CLIENT_ID`` + ``ML_CLIENT_SECRET`` (the
client-credentials grant, cached until it expires).

Design mirrors the VTEX scraper: a *pure* parser + an *injectable* fetch, so the
parsing/relevance logic is unit-tested offline against a fixture, with zero
network. Precision is handled by a token-overlap relevance score: weak matches
are flagged ``needs_review`` (kept out of results) rather than shown as a wrong
price.
"""
from __future__ import annotations

import json
import logging
import random
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from typing import Callable, Optional

from worker.scrapers.base import ScrapedOffer

log = logging.getLogger("scraper")

FetchJson = Callable[[str, Optional[str]], object]

_DEFAULT_UA = "InstrumentaBot/1.0 (+https://instrumenta.app; contato@instrumenta.app)"
_TOKEN_URL = "https://api.mercadolibre.com/oauth/token"
_SEARCH_URL = "https://api.mercadolibre.com/sites/{site}/search?q={q}&limit={limit}"
_STOP = {"de", "da", "do", "para", "com", "e", "the", "of", "n", "kit", "und", "un", "pcs"}


# ---------------------------------------------------------------------------
# Pure helpers (unit-tested)
# ---------------------------------------------------------------------------
def _norm(s: str) -> str:
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9\s]", " ", s)


def _tokens(s: str) -> set[str]:
    return {t for t in _norm(s).split() if len(t) > 2 and t not in _STOP}


def relevance(query: str, title: str) -> float:
    """Share of the query's meaningful tokens present in the listing title (0..1)."""
    q = _tokens(query)
    if not q:
        return 0.0
    return len(q & _tokens(title)) / len(q)


def parse_ml_results(payload: object, query: str, store_id: str = "mercadolivre",
                     max_results: int = 10, min_relevance: float = 0.34) -> list[ScrapedOffer]:
    """Turn a Mercado Livre search payload into candidate offers (best first)."""
    results = payload.get("results") if isinstance(payload, dict) else None
    scored: list[tuple[float, ScrapedOffer]] = []
    for r in (results or [])[:max_results]:
        if not isinstance(r, dict):
            continue
        price = r.get("price")
        title = r.get("title") or ""
        if not price or price <= 0 or not title:
            continue
        rel = relevance(query, title)
        if rel < min_relevance:
            continue                                  # too weak — not this product
        avail = r.get("available_quantity")
        in_stock = (avail is None) or (avail > 0)
        scored.append((rel, ScrapedOffer(
            store_id=store_id,
            standard_name=query,                      # link back to the student's item
            brand=None,
            price=float(price),
            url=r.get("permalink") or "",
            title=title,
            ean=None,
            image_url=r.get("thumbnail") or r.get("thumbnail_id"),
            in_stock=bool(in_stock),
            confidence=round(rel, 2),
            match_method="ml_search",
            needs_review=rel < 0.6,                   # weak match => keep out of results
            source="mercadolivre",
            pack_qty=1,
            unit_price=float(price),
        )))
    scored.sort(key=lambda t: (-t[0], t[1].price))    # best match first, then cheaper
    return [offer for _, offer in scored]


# ---------------------------------------------------------------------------
# Auth + fetch (network; imports offline)
# ---------------------------------------------------------------------------
class _TokenCache:
    token: Optional[str] = None
    exp: float = 0.0


_APP_TOKEN = _TokenCache()


def app_token() -> Optional[str]:
    """Return a usable ML token: an explicit one, or a cached client-credentials token."""
    from app.core.config import settings
    if settings.ML_ACCESS_TOKEN:
        return settings.ML_ACCESS_TOKEN
    if not (settings.ML_CLIENT_ID and settings.ML_CLIENT_SECRET):
        return None
    now = time.time()
    if _APP_TOKEN.token and _APP_TOKEN.exp - 60 > now:
        return _APP_TOKEN.token
    data = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": settings.ML_CLIENT_ID,
        "client_secret": settings.ML_CLIENT_SECRET,
    }).encode()
    req = urllib.request.Request(_TOKEN_URL, data=data, headers={
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
    })
    with urllib.request.urlopen(req, timeout=15) as r:  # noqa: S310
        j = json.loads(r.read().decode("utf-8"))
    _APP_TOKEN.token = j.get("access_token")
    _APP_TOKEN.exp = now + float(j.get("expires_in") or 0)
    return _APP_TOKEN.token


def default_fetch_json(url: str, token: Optional[str], timeout: float = 15.0) -> object:
    headers = {"User-Agent": _DEFAULT_UA, "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:  # noqa: S310
        return json.loads(r.read().decode("utf-8"))


# ---------------------------------------------------------------------------
# Scraper
# ---------------------------------------------------------------------------
class MercadoLivreScraper:
    store_id = "mercadolivre"
    store_name = "Mercado Livre"

    def __init__(self, fetch_json: Optional[FetchJson] = None, token_provider=None):
        self._fetch = fetch_json or default_fetch_json
        self._token = token_provider or app_token

    def _url(self, term: str) -> str:
        from app.core.config import settings
        site = getattr(settings, "ML_SITE", "MLB")
        limit = getattr(settings, "ML_MAX_RESULTS", 10)
        return _SEARCH_URL.format(site=site, q=urllib.parse.quote_plus(term), limit=limit)

    def scrape(self, names: list[str]) -> list[ScrapedOffer]:
        from app.core.config import settings
        token = self._token()
        offers: list[ScrapedOffer] = []
        for name in names:
            try:
                # bias generic terms toward dental supplies
                q = name if "odont" in _norm(name) else f"{name} odontologico"
                data = self._fetch(self._url(q), token)
                best = parse_ml_results(data, name, self.store_id,
                                        max_results=getattr(settings, "ML_MAX_RESULTS", 10))
                if best:
                    offers.append(best[0])            # single best listing per item
            except Exception as exc:  # noqa: BLE001
                log.warning("ml fetch failed", extra={"extra_fields": {"query": name}}, exc_info=exc)
            self._sleep()
        return offers

    def _sleep(self) -> None:
        from app.core.config import settings
        base = getattr(settings, "SCRAPE_RATE_LIMIT_SECONDS", 1.0)
        time.sleep(base + random.uniform(0, base))
