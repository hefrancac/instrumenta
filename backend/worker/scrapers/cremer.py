"""Dental Cremer — VTEX Catalog scraper (the one fully-wired real store).

Dental Cremer (dentalcremer.com.br, an LSI / Henry Schein company) runs on VTEX,
so we read prices/EAN/stock from its public catalog endpoint instead of scraping
HTML. Before enabling in production, confirm the host + sales channel with
`python scripts/probe_vtex.py www.dentalcremer.com.br "espelho bucal"` — it prints
the product count and whether price/EAN/stock come through, so any storefront
change is caught in seconds.
"""
from __future__ import annotations

from worker.scrapers.vtex import VtexScraper


class CremerScraper(VtexScraper):
    store_id = "cremer"
    store_name = "Dental Cremer"
    host = "www.dentalcremer.com.br"
    sales_channel = 1
