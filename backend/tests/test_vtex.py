"""Tests for the VTEX Catalog scraper, run offline against a saved fixture.

Proves the parsing + matching + pack logic without any network access: the
scraper's fetcher is injected with a loader that returns the fixture payload.
"""
import json
import os

from worker.scrapers.vtex import VtexScraper, parse_vtex_products

FIXTURE = os.path.join(os.path.dirname(__file__), "..", "worker", "scrapers",
                       "fixtures", "vtex_search_sample.json")


def _load():
    with open(FIXTURE, encoding="utf-8") as f:
        return json.load(f)


def test_parse_drops_unpriced_and_keeps_the_rest():
    listings = parse_vtex_products(_load())
    # 5 products in fixture, one has Price 0 -> dropped => 4 listings
    assert len(listings) == 4
    titles = [l.title for l in listings]
    assert any("Item Sem Preço" == t for t in titles) is False


def test_parse_reads_price_ean_brand_stock():
    listings = parse_vtex_products(_load())
    esp = next(l for l in listings if l.url.endswith("espelho-bucal-plano-n5/p"))
    assert esp.price == 12.90 and esp.brand == "Golgran" and esp.in_stock is True
    assert esp.ean == "7898906320011" and esp.url.endswith("/p")
    sonda = next(l for l in listings if l.ean == "7891234000027")
    assert sonda.price == 9.90 and sonda.in_stock is True   # from AvailableQuantity


def test_out_of_stock_flag_passes_through():
    esgotado = [l for l in parse_vtex_products(_load())
                if l.url.endswith("espelho-esgotado/p")]
    assert len(esgotado) == 1 and esgotado[0].in_stock is False


class _FixtureCremer(VtexScraper):
    store_id = "cremer"
    store_name = "Dental Cremer"
    host = "www.dentalcremer.com.br"


def test_scraper_end_to_end_matches_and_prices():
    fixture = _load()
    s = _FixtureCremer(fetch_json=lambda url: fixture)
    s._sleep = lambda: None                     # no real delay in tests
    offers = s.scrape(["espelho", "sonda", "sutura"] )
    # Same fixture returned for each term -> dedup by (ean, in_stock) for clarity
    by_ean = {}
    for o in offers:
        by_ean.setdefault(o.ean, o)
    # matched via EAN -> high confidence, canonical names
    assert by_ean["7898906320011"].standard_name == "Espelho Bucal Plano nº 5"
    assert by_ean["7898906320011"].match_method == "ean"
    assert by_ean["7891234000027"].standard_name == "Sonda Exploradora nº 5"
    # pack parsed from the VTEX title + per-unit price computed
    sut = by_ean["7891010900069"]
    assert sut.pack_qty == 24
    assert sut.unit_price == round(42.00 / 24, 2)
    assert sut.source == "vtex"


def test_scraper_survives_bad_payload():
    s = _FixtureCremer(fetch_json=lambda url: {"unexpected": "shape"})
    s._sleep = lambda: None
    assert s.scrape(["espelho"]) == []          # no crash, just empty
