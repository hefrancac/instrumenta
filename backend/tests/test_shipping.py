"""Tests for CEP-based, weight-based freight estimation."""
from app.services.shipping import estimate_freight, region_from_cep, region_multiplier


def test_cep_maps_to_region():
    assert region_from_cep("01310-000") == "SP"   # São Paulo
    assert region_from_cep("90010-000") == "S"    # Porto Alegre
    assert region_from_cep("40010-000") == "NE"   # Salvador
    assert region_from_cep("69010-000") == "N"    # Manaus
    assert region_from_cep("70040-000") == "CO"   # Brasília


def test_missing_cep_defaults_sp():
    assert region_from_cep(None) == "SP"
    assert region_from_cep("") == "SP"


def test_distant_regions_cost_more():
    assert region_multiplier("69010-000") > region_multiplier("01310-000")


def test_freight_grows_with_weight():
    light = estimate_freight(20.0, 10.0, 200, 1.0)
    heavy = estimate_freight(20.0, 10.0, 2000, 1.0)
    assert heavy > light


def test_freight_scales_with_region():
    sp = estimate_freight(20.0, 10.0, 1000, region_multiplier("01310-000"))
    north = estimate_freight(20.0, 10.0, 1000, region_multiplier("69010-000"))
    assert north > sp


def test_freight_formula():
    # (20 + 10 * 0.5kg) * 1.5 = 37.5
    assert estimate_freight(20.0, 10.0, 500, 1.5) == 37.5
