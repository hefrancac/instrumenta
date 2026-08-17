"""Surya Dental scraper (skeleton) — HTML storefront (unlike Cremer's VTEX API).

Brand is left to the matching layer (`match_product` detects known brands from the
title), so this only needs to parse the price string off the card.
"""
from __future__ import annotations

import re
from typing import Optional

from worker.scrapers.base import BaseScraper, RawListing


def parse_brl(text: str) -> Optional[float]:
    """Parse a Brazilian price string ('R$ 1.234,56' or 'R$ 12,90') to float."""
    if not text:
        return None
    m = re.search(r"\d[\d.]*,\d{2}", text)          # 1.234,56 / 12,90
    if m:
        try:
            return float(m.group().replace(".", "").replace(",", "."))
        except ValueError:
            return None
    m = re.search(r"\d+(?:\.\d{1,2})?", text)         # plain 12 / 12.90 fallback
    return float(m.group()) if m else None


class SuryaScraper(BaseScraper):
    store_id = "surya"
    store_name = "Surya Dental"
    search_url = "https://www.suryadental.com.br/busca?q={query}"

    # TODO: confirm against live DOM.
    CARD = "div.product-item, li.item"
    NAME = ".product-item-name, .name a"
    PRICE = ".price, span.price-wrapper"
    LINK = "a.product-item-link, .name a"
    IMG = "img.product-image-photo, img"

    def parse_results(self, page, query: str) -> list[RawListing]:
        listings: list[RawListing] = []
        for card in page.query_selector_all(self.CARD)[:6]:
            name_el = card.query_selector(self.NAME)
            price_el = card.query_selector(self.PRICE)
            if not name_el or not price_el:
                continue
            price = parse_brl(price_el.inner_text())
            if price is None:
                continue
            link_el = card.query_selector(self.LINK)
            img_el = card.query_selector(self.IMG)
            title = name_el.inner_text().strip()
            listings.append(RawListing(
                title=title, price=price,
                url=(link_el.get_attribute("href") if link_el else self.search_url.format(query=query)),
                image_url=(img_el.get_attribute("src") if img_el else None),
                brand=None,   # let the matching layer detect the brand from the title
            ))
        return listings
