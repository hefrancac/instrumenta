#!/usr/bin/env python3
"""Probe a VTEX store's public catalog to confirm the scraper mapping.

Run this against a live store BEFORE enabling it in production (and any time a
store might have changed). It hits the public search endpoint, shows what comes
back, and reports how many results map to our catalog — so wiring or validating a
new store takes seconds instead of guesswork.

Usage:
    python scripts/probe_vtex.py www.dentalcremer.com.br "espelho bucal"
    python scripts/probe_vtex.py www.dentalcremer.com.br "sonda exploradora" --sc 1

Note: respect each store's Terms of Service and robots policy. The public catalog
endpoint is what the storefront itself calls, but prefer an affiliate/data
agreement for anything at scale.
"""
from __future__ import annotations

import argparse
import sys

from worker.scrapers.base import match_listing
from worker.scrapers.vtex import VtexScraper, default_fetch_json, parse_vtex_products


def main() -> int:
    ap = argparse.ArgumentParser(description="Probe a VTEX store's catalog search.")
    ap.add_argument("host", help="store host, e.g. www.dentalcremer.com.br")
    ap.add_argument("term", help="search term, e.g. 'espelho bucal'")
    ap.add_argument("--sc", type=int, default=1, help="VTEX sales channel (trade policy)")
    ap.add_argument("--limit", type=int, default=8, help="rows to print")
    args = ap.parse_args()

    class _Probe(VtexScraper):
        host = args.host
        sales_channel = args.sc
        store_id = "probe"

    url = _Probe()._search_url(args.term)
    print(f"GET {url}\n")
    try:
        data = default_fetch_json(url)
    except Exception as exc:  # noqa: BLE001
        print(f"✗ request failed: {exc}")
        print("  (network/DNS blocked here? run this where the store is reachable.)")
        return 2

    if not isinstance(data, list):
        print(f"✗ unexpected payload type: {type(data).__name__} — is this a VTEX store?")
        return 3

    listings = parse_vtex_products(data)
    print(f"products returned: {len(data)}   parsed listings: {len(listings)}\n")

    priced = sum(1 for l in listings if l.price)
    with_ean = sum(1 for l in listings if l.ean)
    in_stock = sum(1 for l in listings if l.in_stock)
    matched = 0
    print(f"{'PRICE':>9}  {'EAN':<14} {'STOCK':<6} {'MATCH (conf)':<28} TITLE")
    print("-" * 100)
    for l in listings[: args.limit]:
        offer = match_listing("probe", l, source="vtex")
        if offer:
            matched += 1
            m = f"{offer.standard_name[:20]} ({offer.confidence:.2f}/{offer.match_method})"
        else:
            m = "— no match —"
        ean = l.ean or "-"
        stock = "yes" if l.in_stock else "no"
        print(f"{l.price:>9.2f}  {ean:<14} {stock:<6} {m:<28} {l.title[:44]}")

    total_matched = sum(1 for l in listings if match_listing('probe', l, source='vtex'))
    print("\nsummary:")
    print(f"  priced:   {priced}/{len(listings)}")
    print(f"  with EAN: {with_ean}/{len(listings)}")
    print(f"  in stock: {in_stock}/{len(listings)}")
    print(f"  matched to catalog: {total_matched}/{len(listings)}")
    if total_matched == 0 and listings:
        print("\n  ⚠ nothing matched — check catalog keywords/EANs or the search term.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
