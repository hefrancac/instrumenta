"""Scraper selection.

`get_scrapers()` returns the mock scraper in dev/tests and the real per-store
scrapers in production, driven by SCRAPER_MODE. Add a new store by dropping a
BaseScraper subclass into this list.
"""
from __future__ import annotations

from app.core.config import settings
from worker.scrapers.cremer import CremerScraper
from worker.scrapers.mercadolivre import MercadoLivreScraper
from worker.scrapers.mock import MockScraper
from worker.scrapers.surya import SuryaScraper

# Cremer is fully wired (VTEX public catalog). Add more VTEX stores by
# subclassing VtexScraper (see cremer.py) after confirming host/sc with
# scripts/probe_vtex.py. Surya remains a stub until its platform is confirmed.
LIVE_SCRAPERS = [CremerScraper]


def _ml_configured() -> bool:
    return bool(settings.ML_ACCESS_TOKEN or (settings.ML_CLIENT_ID and settings.ML_CLIENT_SECRET))


def get_scrapers():
    mode = settings.SCRAPER_MODE
    # Marketplace: search Mercado Livre for every item (covers the long tail,
    # not just the fixed catalog). Requires ML credentials.
    if mode == "marketplace" and _ml_configured():
        return [MercadoLivreScraper()]
    if mode == "live":
        scrapers = [cls() for cls in LIVE_SCRAPERS]
        if _ml_configured():
            scrapers.append(MercadoLivreScraper())
        return scrapers
    return [MockScraper()]
