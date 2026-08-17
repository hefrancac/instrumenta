"""Mercado Livre source — parsing/relevance verified offline against a fixture.

No network: the fetch is injected. Mirrors test_vtex.py.
"""
import json
import pathlib

from worker.scrapers.mercadolivre import (
    MercadoLivreScraper, parse_ml_results, relevance,
)

FIXTURE = pathlib.Path(__file__).parent.parent / "worker" / "scrapers" / "fixtures" / "ml_search_sample.json"


def _payload():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def test_relevance_scores_tokens():
    assert relevance("sonda exploradora nº 5", "Sonda Exploradora Nº 5 Golgran") > 0.9
    assert relevance("sonda exploradora", "Capa Para Celular Samsung") == 0.0


def test_parse_keeps_relevant_priced_in_stock_first():
    offers = parse_ml_results(_payload(), query="sonda exploradora nº 5")
    # The phone case (irrelevant) is filtered out entirely.
    assert all("celular" not in o.title.lower() for o in offers)
    assert offers, "expected at least one relevant offer"
    best = offers[0]
    assert best.store_id == "mercadolivre"
    assert best.standard_name == "sonda exploradora nº 5"   # links back to the item
    assert best.price == 12.9
    assert best.url.startswith("https://")
    assert best.image_url and best.image_url.endswith(".jpg")
    assert best.in_stock is True
    assert best.source == "mercadolivre"
    assert best.confidence >= 0.6 and best.needs_review is False


def test_out_of_stock_flagged_not_dropped():
    offers = parse_ml_results(_payload(), query="sonda milimetrada")
    milli = [o for o in offers if "milimetrada" in o.title.lower()]
    assert milli and milli[0].in_stock is False


def test_weak_match_is_review_gated():
    # A one-token query weakly overlaps the multi-word titles.
    offers = parse_ml_results(_payload(), query="sonda", min_relevance=0.0)
    assert offers and all(o.needs_review for o in offers if o.confidence < 0.6)


def test_bad_payload_does_not_crash():
    assert parse_ml_results(None, "x") == []
    assert parse_ml_results({"results": [1, 2, "nope"]}, "x") == []
    assert parse_ml_results({}, "x") == []


def test_scraper_uses_injected_fetch_and_token():
    calls = {}

    def fake_fetch(url, token):
        calls["url"] = url
        calls["token"] = token
        return _payload()

    scraper = MercadoLivreScraper(fetch_json=fake_fetch, token_provider=lambda: "TESTTOKEN")
    scraper._sleep = lambda: None  # no rate-limit delay in tests
    offers = scraper.scrape(["sonda exploradora nº 5"])
    assert len(offers) == 1                      # single best listing per item
    assert offers[0].price == 12.9
    assert calls["token"] == "TESTTOKEN"
    assert "api.mercadolibre.com" in calls["url"]
