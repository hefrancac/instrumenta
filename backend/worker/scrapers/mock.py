"""Offline scraper (SCRAPER_MODE=mock).

Produces raw listings from the catalog (titles + EANs) and runs them through the
real matching layer — so dev/tests exercise confidence scoring end to end.
"""
from __future__ import annotations

from worker.scrapers.base import RawListing, ScrapedOffer, match_listing
from app.services.catalog import generate_offers


class MockScraper:
    store_id = "mock"
    store_name = "Mock"

    def scrape(self, names: list[str]) -> list[ScrapedOffer]:
        wanted = set(names)
        offers: list[ScrapedOffer] = []
        for o in generate_offers():
            if o.standard_name not in wanted:
                continue
            listing = RawListing(title=o.title, price=o.price, url=o.url,
                                 ean=o.ean, brand=o.brand)
            offer = match_listing(o.store_id, listing)   # exercise matching
            if offer:
                offer.source = "seed"
                offers.append(offer)
        return offers
