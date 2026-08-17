"""Tests for the pure optimizer v2 — thresholds, quantities, consolidation."""
from app.services.catalog import CATALOG, STORES, NO_ESTIMATE, generate_offers
from app.services.optimizer import (
    Offer, RequiredItem, StoreInfo, compute_multi, compute_single, optimize,
)


def _stores():
    return [StoreInfo(s["id"], s["name"], s["shipping"], s["free_shipping"]) for s in STORES]


def _offers():
    return [Offer(o.standard_name, o.store_id, o.price, o.brand, o.url, o.in_stock)
            for o in generate_offers()]


def _all_required(qty=1):
    # Itens com preço estimável (exclui equipamento "a confirmar", sem oferta).
    return [RequiredItem(p.standard_name, None, qty) for p in CATALOG if p.id not in NO_ESTIMATE]


# --- basics -----------------------------------------------------------------
def test_empty_list_is_safe():
    res = optimize([], [], _stores())
    assert res["recommend"] == "single"
    assert res["multi"]["total"] == 0
    assert res["single"]["best"] is None


def test_single_store_ranked_by_coverage_then_price():
    ranking = compute_single(_all_required(), _offers(), _stores())
    assert ranking[0]["store_id"] == "cremer"
    assert ranking[0]["complete"] is True
    covs = [r["coverage"] for r in ranking]
    assert covs == sorted(covs, reverse=True)


def test_single_store_items_sorted_desc():
    ranking = compute_single(_all_required(), _offers(), _stores())
    prices = [i["line_total"] for i in ranking[0]["items"]]
    assert prices == sorted(prices, reverse=True)


def test_multi_beats_single_on_this_list():
    res = optimize(_all_required(), _offers(), _stores())
    assert res["recommend"] == "multi"
    assert res["savings"] > 0
    assert res["multi"]["total"] < res["base_single_total"]
    # coverage preserved
    assert not res["multi"]["unavailable"]


# --- free shipping ----------------------------------------------------------
def test_free_shipping_waived_when_over_threshold():
    stores = [StoreInfo("a", "A", 25.0, free_shipping_threshold=200.0)]
    required = [RequiredItem("X", None)]
    offers = [Offer("X", "a", 250.0)]
    best = optimize(required, offers, stores)["single"]["best"]
    assert best["shipping"] == 0.0
    assert best["free_shipping_eligible"] is True
    assert best["total"] == 250.0


def test_amount_to_free_shipping_reported():
    stores = [StoreInfo("a", "A", 25.0, free_shipping_threshold=200.0)]
    required = [RequiredItem("X", None)]
    offers = [Offer("X", "a", 150.0)]
    best = optimize(required, offers, stores)["single"]["best"]
    assert best["shipping"] == 25.0
    assert best["amount_to_free_shipping"] == 50.0
    assert best["total"] == 175.0


def test_consolidation_beats_greedy_via_free_shipping():
    # Splitting = 2 fretes; consolidating into A crosses free-shipping (>=100).
    stores = [StoreInfo("a", "A", 30.0, 100.0), StoreInfo("b", "B", 30.0, 100.0)]
    required = [RequiredItem("X", None), RequiredItem("Y", None)]
    offers = [Offer("X", "a", 60.0), Offer("X", "b", 62.0),
              Offer("Y", "a", 45.0), Offer("Y", "b", 44.0)]
    multi = compute_multi(required, offers, stores)
    # Greedy would be X@a + Y@b = 60+44 + 60 shipping = 164. Optimal is A-only = 105.
    assert multi["total"] == 105.0
    assert multi["store_count"] == 1
    assert multi["shipping_saved"] == 30.0


def test_local_search_moves_item_to_cross_threshold():
    stores = [StoreInfo("a", "A", 20.0, 50.0), StoreInfo("b", "B", 5.0, 1000.0)]
    required = [RequiredItem("X", None), RequiredItem("Y", None)]
    offers = [Offer("X", "a", 40.0), Offer("X", "b", 39.0),
              Offer("Y", "a", 15.0), Offer("Y", "b", 14.0)]
    multi = compute_multi(required, offers, stores)
    # A-only: 40+15 = 55 >= 50 -> free. Beats greedy B (39+14+5 = 58).
    assert multi["total"] == 55.0
    assert multi["store_count"] == 1


# --- quantities -------------------------------------------------------------
def test_quantity_multiplies_line_totals():
    stores = [StoreInfo("a", "A", 0.0)]
    required = [RequiredItem("X", None, quantity=3)]
    offers = [Offer("X", "a", 10.0)]
    best = optimize(required, offers, stores)["single"]["best"]
    row = best["items"][0]
    assert row["quantity"] == 3
    assert row["unit_price"] == 10.0
    assert row["line_total"] == 30.0
    assert best["subtotal"] == 30.0


# --- guards -----------------------------------------------------------------
def test_brand_filter_respected():
    stores = [StoreInfo("a", "A", 0.0)]
    required = [RequiredItem("Resina", brand="FGM Opallis")]
    offers = [Offer("Resina", "a", 129.9, brand="3M Filtek"),
              Offer("Resina", "a", 79.9, brand="FGM Opallis")]
    best = optimize(required, offers, stores)["single"]["best"]
    assert best["items"][0]["unit_price"] == 79.9


def test_out_of_stock_offers_ignored():
    stores = [StoreInfo("a", "A", 0.0)]
    required = [RequiredItem("X", None)]
    offers = [Offer("X", "a", 5.0, in_stock=False)]
    res = optimize(required, offers, stores)
    assert res["multi"]["unavailable"] == ["X"]


# --- v3: per-unit / pack pricing -------------------------------------------
def test_pack_buys_whole_packs_and_reports_unit_price():
    stores = [StoreInfo("a", "A", 0.0)]
    required = [RequiredItem("Sutura", None, quantity=30)]      # need 30 units
    offers = [Offer("Sutura", "a", 40.0, pack_qty=24)]         # a box of 24
    best = optimize(required, offers, stores)["single"]["best"]
    row = best["items"][0]
    assert row["pack_qty"] == 24
    assert row["packs"] == 2                 # ceil(30/24)
    assert row["line_total"] == 80.0         # 2 boxes
    assert row["unit_price"] == round(40.0 / 24, 2)
    assert best["subtotal"] == 80.0


def test_pack_efficiency_beats_unit_price_sticker():
    # Same product: A sells singles at 10, B sells a box of 24 at 48.
    stores = [StoreInfo("a", "A", 0.0), StoreInfo("b", "B", 0.0)]
    required = [RequiredItem("Luva", None, quantity=24)]
    offers = [Offer("Luva", "a", 10.0, pack_qty=1),
              Offer("Luva", "b", 48.0, pack_qty=24)]
    res = optimize(required, offers, stores)
    cc = res["single"]["cheapest_complete"]
    assert cc["store_id"] == "b"             # 48 < 24*10
    assert cc["total"] == 48.0


# --- v3: freight by CEP + weight -------------------------------------------
def test_freight_uses_weight_and_region_multiplier():
    stores = [StoreInfo("a", "A", 20.0, None, shipping_per_kg=10.0, region_multiplier=1.5)]
    required = [RequiredItem("Cadeira", None, quantity=1, weight_g=500)]
    offers = [Offer("Cadeira", "a", 50.0)]
    best = optimize(required, offers, stores)["single"]["best"]
    assert best["shipping"] == 37.5          # (20 + 10*0.5) * 1.5
    assert best["total"] == 87.5


def test_distant_region_costs_more():
    def total(mult):
        stores = [StoreInfo("a", "A", 20.0, None, shipping_per_kg=10.0, region_multiplier=mult)]
        required = [RequiredItem("X", None, quantity=1, weight_g=1000)]
        return optimize(required, [Offer("X", "a", 30.0)], stores)["single"]["best"]["shipping"]
    assert total(1.75) > total(1.0)


def test_free_shipping_waives_freight_regardless_of_weight():
    stores = [StoreInfo("a", "A", 20.0, 40.0, shipping_per_kg=10.0, region_multiplier=1.75)]
    required = [RequiredItem("X", None, quantity=1, weight_g=9999)]
    best = optimize(required, [Offer("X", "a", 50.0)], stores)["single"]["best"]
    assert best["free_shipping_eligible"] is True
    assert best["shipping"] == 0.0
