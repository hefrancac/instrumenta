"""Tests for the product-matching layer (pure logic)."""
from app.services.product_matching import ACCEPT, REVIEW, match_product


def test_ean_is_authoritative():
    m = match_product("qualquer titulo aleatorio", ean="7896548120041")
    assert m is not None
    assert m.canonical_id == "resina"
    assert m.method == "ean"
    assert m.confidence == 1.0
    assert m.needs_review is False


def test_high_confidence_full_title():
    m = match_product("Sonda Exploradora nº 5 Golgran Ref 1234")
    assert m is not None
    assert m.canonical_id == "sonda-exp"
    assert m.confidence >= ACCEPT
    assert m.needs_review is False


def test_generic_full_name_accepts():
    # Seeded generic offers carry the full canonical name without a brand.
    m = match_product("Espelho Bucal Plano nº 5")
    assert m is not None
    assert m.canonical_id == "espelho"
    assert m.needs_review is False


def test_brand_disambiguates_resin():
    m = match_product("Resina Composta Filtek Z350 XT Cor A2 3M")
    assert m.canonical_id == "resina"
    assert m.confidence >= ACCEPT


def test_partial_title_goes_to_review():
    # Matches 'espelho' strongly but the title is vague / combined.
    m = match_product("Sonda e Espelho Bucal")
    assert m is not None
    assert m.canonical_id == "espelho"
    assert REVIEW <= m.confidence < ACCEPT or m.needs_review is True
    assert m.needs_review is True


def test_no_match_returns_none():
    assert match_product("Luva de Procedimento Nitrílica Tamanho M") is None


def test_all_seeded_titles_match_confidently():
    # Every seeded offer title should auto-accept — the pipeline must not flood
    # the review queue with its own catalog.
    from app.services.catalog import generate_offers
    for o in generate_offers():
        m = match_product(o.title, brand=o.brand, ean=o.ean)
        assert m is not None, o.title
        assert m.canonical_id  # resolved
        assert m.needs_review is False, (o.title, m.confidence)
