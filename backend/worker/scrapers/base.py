"""Scraper contracts.

`parse_results` now returns raw listings (title/price/ean); the base runs each
listing through the product-matching layer, so every cached offer carries a
canonical id, a confidence, and a needs_review flag — we never blindly trust a
search result. `FeedScraper` is the preferred path where a store exposes a
product feed (XML/CSV/Google Merchant): more stable and more defensible than
headless browsing.
"""
from __future__ import annotations

import logging
import random
import time
from dataclasses import dataclass
from typing import Optional
from urllib.parse import quote_plus

from app.services.product_matching import match_product
from app.services.units import parse_pack, unit_price

log = logging.getLogger("scraper")


@dataclass
class RawListing:
    title: str
    price: float
    url: str
    image_url: Optional[str] = None
    ean: Optional[str] = None
    brand: Optional[str] = None
    in_stock: bool = True


@dataclass
class ScrapedOffer:
    store_id: str
    standard_name: str          # canonical, decided by matching
    brand: Optional[str]
    price: float
    url: str
    title: str
    ean: Optional[str] = None
    image_url: Optional[str] = None
    in_stock: bool = True
    confidence: float = 1.0
    match_method: str = "similarity"
    needs_review: bool = False
    source: str = "scrape"
    pack_qty: int = 1
    unit_price: Optional[float] = None


def match_listing(store_id: str, listing: RawListing, source: str = "scrape") -> Optional[ScrapedOffer]:
    """Resolve a raw listing to a canonical offer, or drop it if not confident."""
    m = match_product(listing.title, brand=listing.brand, ean=listing.ean)
    if m is None:
        return None
    pack = parse_pack(listing.title).pack_qty
    return ScrapedOffer(
        store_id=store_id, standard_name=m.standard_name, brand=listing.brand,
        price=listing.price, url=listing.url, title=listing.title, ean=listing.ean,
        image_url=listing.image_url, in_stock=listing.in_stock,
        confidence=m.confidence, match_method=m.method,
        needs_review=m.needs_review, source=source,
        pack_qty=pack, unit_price=unit_price(listing.price, pack),
    )


class BaseScraper:
    store_id: str = ""
    store_name: str = ""
    search_url: str = ""          # must contain "{query}"

    def parse_results(self, page, query: str) -> list[RawListing]:  # pragma: no cover
        """Given a loaded search page, return raw listings for `query`."""
        raise NotImplementedError

    def _proxy(self) -> Optional[dict]:
        from app.core.config import settings
        return {"server": settings.PROXY_URL} if settings.PROXY_URL else None

    def scrape(self, names: list[str]) -> list[ScrapedOffer]:
        from app.core.config import settings
        from playwright.sync_api import sync_playwright
        try:
            from playwright_stealth import stealth_sync
        except Exception:  # noqa: BLE001
            stealth_sync = None

        offers: list[ScrapedOffer] = []
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=True, proxy=self._proxy(),
                args=["--no-sandbox", "--disable-blink-features=AutomationControlled"])
            context = browser.new_context(
                locale="pt-BR",
                user_agent=("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                            "(KHTML, like Gecko) Chrome/122 Safari/537.36"))
            page = context.new_page()
            if stealth_sync:
                stealth_sync(page)
            for name in names:
                try:
                    page.goto(self.search_url.format(query=quote_plus(name)),
                              timeout=settings.SCRAPE_TIMEOUT_MS, wait_until="domcontentloaded")
                    for listing in self.parse_results(page, name):
                        offer = match_listing(self.store_id, listing)
                        if offer is not None:
                            offers.append(offer)
                except Exception as exc:  # noqa: BLE001
                    log.warning("scrape failed", extra={"extra_fields":
                                {"store": self.store_id, "query": name}}, exc_info=exc)
                self._sleep()
            context.close()
            browser.close()
        return offers

    def _sleep(self) -> None:
        from app.core.config import settings
        base = settings.SCRAPE_RATE_LIMIT_SECONDS
        time.sleep(base + random.uniform(0, base))


class FeedScraper:
    """Preferred where a store publishes a product feed. Fetch + parse, no browser."""
    store_id: str = ""
    store_name: str = ""
    feed_url: str = ""

    def parse_feed(self, content: bytes) -> list[RawListing]:  # pragma: no cover
        raise NotImplementedError

    def scrape(self, names: list[str]) -> list[ScrapedOffer]:
        from app.core.config import settings
        import httpx
        wanted = {n.lower() for n in names}
        offers: list[ScrapedOffer] = []
        try:
            resp = httpx.get(self.feed_url, timeout=settings.SCRAPE_TIMEOUT_MS / 1000)
            resp.raise_for_status()
            for listing in self.parse_feed(resp.content):
                offer = match_listing(self.store_id, listing, source="feed")
                if offer and (not wanted or any(w in offer.standard_name.lower() for w in wanted)):
                    offers.append(offer)
        except Exception as exc:  # noqa: BLE001
            log.warning("feed fetch failed", extra={"extra_fields": {"store": self.store_id}}, exc_info=exc)
        return offers
