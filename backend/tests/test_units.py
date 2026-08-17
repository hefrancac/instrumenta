"""Tests for pack parsing and per-unit pricing."""
from app.services.units import packs_needed, parse_pack, unit_price


def test_box_with_count_unit():
    assert parse_pack("Fio de Sutura Seda 4-0 Caixa com 24 unidades").pack_qty == 24


def test_box_without_unit_word():
    assert parse_pack("Lençol de Borracha Caixa com 26 Folhas").pack_qty == 26


def test_kit_with_number():
    assert parse_pack("Kit 10 Brocas Diamantadas KG Sorensen").pack_qty == 10


def test_slash_notation():
    assert parse_pack("Dique Odontológico c/ 26").pack_qty == 26


def test_single_unit_default():
    assert parse_pack("Espelho Bucal Plano nº 5 Golgran").pack_qty == 1


def test_gauge_and_number_not_treated_as_pack():
    # "nº 5", "z350", "4-0", "37%", "150" must not be read as counts.
    assert parse_pack("Sonda Exploradora Nº 5 Duflex").pack_qty == 1
    assert parse_pack("Resina Z350 XT A2").pack_qty == 1
    assert parse_pack("Fórceps nº 150 Adulto").pack_qty == 1


def test_size_parsed():
    p = parse_pack("Resina Composta Z350 XT A2 4g")
    assert p.pack_qty == 1 and p.unit_value == 4.0 and p.unit_label == "g"
    p2 = parse_pack("Ácido Fosfórico 37% Seringa 2,5ml")
    assert p2.pack_qty == 1 and p2.unit_value == 2.5 and p2.unit_label == "ml"


def test_packs_needed_ceils():
    assert packs_needed(30, 24) == 2
    assert packs_needed(24, 24) == 1
    assert packs_needed(1, 24) == 1
    assert packs_needed(49, 24) == 3


def test_unit_price():
    assert unit_price(48.0, 24) == 2.0
    assert unit_price(40.0, 1) == 40.0
