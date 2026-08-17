"""VTEX Catalog scraper (JSON, not HTML).

Most large Brazilian dental stores run on VTEX, which exposes the same public
catalog endpoint the storefront itself calls:

    GET https://{host}/api/catalog_system/pub/products/search/?ft={term}&sc={sc}

It returns structured JSON — price, EAN/GTIN, stock and brand per SKU — so we
avoid HTML scraping, anti-bot walls, and brittle CSS selectors entirely. Each SKU
becomes a RawListing and flows through the same matching + pack-parsing layer as
every other source.

Design notes:
  * `parse_vtex_products()` is pure and unit-tested against a saved fixture, so the
    parsing logic is verified without network access.
  * `VtexScraper` takes an injectable `fetch_json` (tests pass a fixture loader);
    the production default uses the standard library (urllib) — zero extra deps.
  * Be a good citizen: identify via User-Agent, rate-limit, and respect each
    store's Terms of Service. Prefer an affiliate/data agreement where possible.
"""
from __future__ import annotations

import json
import logging
import random
import time
import urllib.request
from typing import Callable, Optional
from urllib.parse import quote_plus

from worker.scrapers.base import RawListing, ScrapedOffer, match_listing

log = logging.getLogger("scraper")

FetchJson = Callable[[str], object]

_DEFAULT_UA = "InstrumentaBot/1.0 (+https://instrumenta.app; contato@instrumenta.app)"


# ---------------------------------------------------------------------------
# Pure parsing (unit-tested with a fixture)
# ---------------------------------------------------------------------------
def _default_seller(sellers: list[dict]) -> Optional[dict]:
    if not sellers:
        return None
    for s in sellers:
        if s.get("sellerDefault"):
            return s
    return sellers[0]


def _first_image(item: dict) -> Optional[str]:
    imgs = item.get("images") or []
    if imgs and isinstance(imgs, list):
        return imgs[0].get("imageUrl")
    return None


def _ean(item: dict) -> Optional[str]:
    ean = item.get("ean")
    if ean and str(ean).strip() and str(ean).strip() != "0":
        return str(ean).strip()
    # some catalogs stash the barcode in referenceId
    for ref in item.get("referenceId") or []:
        if ref.get("Key") in ("RefId", "EAN") and ref.get("Value"):
            v = str(ref["Value"]).strip()
            if v.isdigit() and len(v) >= 8:
                return v
    return None


def parse_vtex_products(products: object) -> list[RawListing]:
    """Turn a VTEX product-search payload into raw listings (one per SKU)."""
    out: list[RawListing] = []
    for p in (products or []):  # type: ignore[union-attr]
        if not isinstance(p, dict):
            continue
        brand = p.get("brand")
        link = p.get("link") or ""
        product_name = p.get("productName") or ""
        for item in p.get("items") or []:
            seller = _default_seller(item.get("sellers") or [])
            offer = (seller or {}).get("commertialOffer") or {}
            price = offer.get("Price")
            if not price or price <= 0:
                continue                      # unpriced / unavailable to buy
            available = offer.get("IsAvailable")
            if available is None:
                available = (offer.get("AvailableQuantity") or 0) > 0
            title = item.get("nameComplete") or item.get("name") or product_name
            if not title:
                continue
            out.append(RawListing(
                title=title, price=float(price), url=link,
                image_url=_first_image(item), ean=_ean(item),
                brand=brand, in_stock=bool(available)))
    return out


# ---------------------------------------------------------------------------
# Production fetcher (stdlib; imports offline, runs when deployed)
# ---------------------------------------------------------------------------
def default_fetch_json(url: str, timeout: float = 15.0) -> object:
    from app.core.config import settings
    ua = getattr(settings, "SCRAPER_USER_AGENT", None) or _DEFAULT_UA
    req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:  # noqa: S310 (trusted host, https)
        return json.loads(r.read().decode("utf-8"))


# ---------------------------------------------------------------------------
# Scraper
# ---------------------------------------------------------------------------
class VtexScraper:
    """Config-driven VTEX store scraper. Subclass and set store_id/store_name/host."""
    store_id: str = ""
    store_name: str = ""
    host: str = ""                 # e.g. "www.dentalcremer.com.br"
    sales_channel: int = 1         # VTEX trade policy (sc)
    page_size: int = 20

    def __init__(self, fetch_json: Optional[FetchJson] = None):
        self._fetch = fetch_json or default_fetch_json

    def _search_url(self, term: str) -> str:
        return (f"https://{self.host}/api/catalog_system/pub/products/search/"
                f"?ft={quote_plus(term)}&sc={self.sales_channel}"
                f"&_from=0&_to={self.page_size - 1}")

    def scrape(self, names: list[str]) -> list[ScrapedOffer]:
        offers: list[ScrapedOffer] = []
        for name in names:
            try:
                data = self._fetch(self._search_url(name))
                for listing in parse_vtex_products(data):
                    offer = match_listing(self.store_id, listing, source="vtex")
                    if offer is not None:
                        offers.append(offer)
            except Exception as exc:  # noqa: BLE001
                log.warning("vtex fetch failed", extra={"extra_fields":
                            {"store": self.store_id, "query": name}}, exc_info=exc)
            self._sleep()
        return offers

    def _sleep(self) -> None:
        from app.core.config import settings
        base = getattr(settings, "SCRAPE_RATE_LIMIT_SECONDS", 1.0)
        time.sleep(base + random.uniform(0, base))
