"""Tests for the name-standardization matcher."""
from app.services.matcher import match_list, normalize


def test_normalize_strips_accents_and_punctuation():
    assert normalize("Pinça Clínica, nº5!") == "pinca clinica n 5"


def test_matches_messy_sample_fully():
    sample = (
        "1 espelho bucal n5\nsonda exploradora n5\npinça clinica\n"
        "resina z350 A2\nionomero de vidro restaurador\nfio de sutura seda 4-0"
    )
    res = match_list(sample)
    assert len(res.matched) == 6
    assert not res.unmatched
    stds = {m.standard_name for m in res.matched}
    assert "Espelho Bucal Plano nº 5" in stds
    assert "Resina Composta Z350 XT (A2)" in stds


def test_exact_duplicate_lines_dedupe():
    res = match_list("espelho bucal\nespelho bucal")
    ids = [m.catalog_id for m in res.matched]
    assert ids.count("espelho") == 1  # an exact repeat of the same line is dropped


def test_distinct_lines_same_product_both_kept():
    # Different lines that map to the same catalog entry are both kept — the
    # student who lists several file sizes should get each one priced.
    res = match_list("caixa de lima 08\ncaixa de lima 10\ncaixa de lima 15")
    limas = [m for m in res.matched if m.catalog_id == "lima-endo"]
    assert len(limas) == 3


def test_unmatched_reported():
    res = match_list("banana\nsonda exploradora")
    assert "banana" in res.unmatched
    assert any(m.catalog_id == "sonda-exp" for m in res.matched)


def test_default_brand_is_cheapest():
    res = match_list("resina z350")
    item = res.matched[0]
    assert item.default_brand == "FGM Opallis"  # cheaper than 3M Filtek
    assert "3M Filtek" in item.brands
