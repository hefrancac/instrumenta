"""
Shipping-aware, pack-aware cart optimizer (v3).

Builds on v2 (free-shipping thresholds + subset enumeration + local search) with
two correctness fixes to the core value engine:

  * Per-unit pricing / whole packs — a listing may contain many base units
    ("caixa com 24"). We compare by per-unit price (fair) and cost by whole packs
    bought (ceil(need / pack_qty) × listing price), since you can't buy half a box.

  * Freight by destination + weight — each store's freight is
    (base + per_kg × order_weight) × region_multiplier (resolved from the CEP),
    still waived when the subtotal crosses the store's free-shipping threshold.
    Because freight now depends on the weight assigned to a store, the multi-store
    optimizer already re-evaluates it per candidate plan.

Everything is pure and unit-tested. Defaults (per_kg=0, region_multiplier=1,
weight=0, pack_qty=1) reproduce the earlier flat-shipping behavior exactly.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from itertools import combinations
from typing import Optional

MAX_ENUM_STORES = 10
RECOMMEND_THRESHOLD = 0.50


# ---------------------------------------------------------------------------
# Inputs
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class StoreInfo:
    id: str
    name: str
    shipping: float                              # base freight
    free_shipping_threshold: Optional[float] = None
    shipping_per_kg: float = 0.0
    region_multiplier: float = 1.0               # resolved from destination CEP


@dataclass(frozen=True)
class Offer:
    standard_name: str
    store_id: str
    price: float                                 # price of one listing
    brand: Optional[str] = None
    url: Optional[str] = None
    in_stock: bool = True
    age_hours: Optional[float] = None
    offer_id: Optional[int] = None
    pack_qty: int = 1                            # base units per listing
    unit_price: Optional[float] = None           # price / pack_qty (derived if None)
    image_url: Optional[str] = None              # product photo (from the marketplace)


@dataclass(frozen=True)
class RequiredItem:
    standard_name: str
    brand: Optional[str] = None
    quantity: int = 1                            # base units the student needs
    weight_g: float = 0.0                        # shipping weight per base unit


def _r(v: float) -> float:
    return round(v + 1e-9, 2)


def _packs(quantity: int, pack_qty: int) -> int:
    pq = max(1, int(pack_qty or 1))
    return max(1, math.ceil(max(1, int(quantity)) / pq))


def _unit_price(offer: Offer) -> float:
    if offer.unit_price is not None:
        return _r(offer.unit_price)
    return _r(offer.price / max(1, int(offer.pack_qty or 1)))


# ---------------------------------------------------------------------------
# Offer resolution — cheapest by *actual* cost for the needed quantity
# ---------------------------------------------------------------------------
def _matching(item: RequiredItem, offers: list[Offer]) -> list[Offer]:
    out = []
    for o in offers:
        if not o.in_stock or o.standard_name != item.standard_name:
            continue
        if item.brand is not None and o.brand != item.brand:
            continue
        out.append(o)
    return out


def _cell_cost(item: RequiredItem, offer: Offer) -> float:
    return _packs(item.quantity, offer.pack_qty) * offer.price


def _best_offer_matrix(required: list[RequiredItem], offers: list[Offer]) -> list[dict[str, Offer]]:
    """matrix[i][store_id] = offer minimizing actual cost for item i in that store."""
    matrix: list[dict[str, Offer]] = []
    for item in required:
        row: dict[str, Offer] = {}
        for o in _matching(item, offers):
            cur = row.get(o.store_id)
            if cur is None or _cell_cost(item, o) < _cell_cost(item, cur):
                row[o.store_id] = o
        matrix.append(row)
    return matrix


def _line(item: RequiredItem, offer: Offer) -> dict:
    packs = _packs(item.quantity, offer.pack_qty)
    line_total = _r(packs * offer.price)
    return {
        "standard_name": item.standard_name,
        "brand": offer.brand,
        "quantity": item.quantity,
        "pack_qty": max(1, int(offer.pack_qty or 1)),
        "packs": packs,
        "unit_price": _unit_price(offer),
        "unit_listing_price": _r(offer.price),
        "line_total": line_total,
        "price": line_total,                     # back-compat: what's summed
        "url": offer.url,
        "offer_id": offer.offer_id,
        "age_hours": offer.age_hours,
        "image_url": offer.image_url,
    }


def _item_weight(item: RequiredItem) -> float:
    return max(0.0, item.weight_g) * max(1, int(item.quantity))


def _shipping_for(store: StoreInfo, subtotal: float, weight_g: float,
                  has_items: bool) -> tuple[float, bool, Optional[float]]:
    """Returns (shipping, free_eligible, amount_to_free)."""
    if not has_items:
        return 0.0, False, None
    thr = store.free_shipping_threshold
    if thr is not None and subtotal >= thr:
        return 0.0, True, 0.0
    base = store.shipping + store.shipping_per_kg * (max(0.0, weight_g) / 1000.0)
    ship = _r(base * store.region_multiplier)
    to_free = _r(thr - subtotal) if thr is not None else None
    return ship, False, to_free


# ---------------------------------------------------------------------------
# Strategy 1 — single store
# ---------------------------------------------------------------------------
def compute_single(required: list[RequiredItem], offers: list[Offer],
                   stores: list[StoreInfo]) -> list[dict]:
    matrix = _best_offer_matrix(required, offers)
    ranking: list[dict] = []
    for store in stores:
        rows, missing, subtotal, weight = [], [], 0.0, 0.0
        for i, item in enumerate(required):
            offer = matrix[i].get(store.id)
            if offer is None:
                missing.append(item.standard_name)
            else:
                rows.append(_line(item, offer))
                subtotal += _cell_cost(item, offer)
                weight += _item_weight(item)
        rows.sort(key=lambda r: r["line_total"], reverse=True)
        shipping, free_ok, to_free = _shipping_for(store, subtotal, weight, bool(rows))
        ranking.append({
            "store_id": store.id, "store_name": store.name,
            "coverage": len(rows), "required_count": len(required),
            "complete": len(rows) == len(required),
            "subtotal": _r(subtotal), "shipping": shipping,
            "total": _r(subtotal + shipping),
            "free_shipping_threshold": store.free_shipping_threshold,
            "free_shipping_eligible": free_ok,
            "amount_to_free_shipping": to_free,
            "items": rows, "missing": missing,
        })
    ranking.sort(key=lambda s: (-s["coverage"], s["total"]))
    return ranking


# ---------------------------------------------------------------------------
# Strategy 2 — multi store (threshold + weight aware)
# ---------------------------------------------------------------------------
def _store_loads(assignment: dict[int, str], required: list[RequiredItem],
                 matrix: list[dict[str, Offer]]) -> dict[str, tuple[float, float]]:
    """store_id -> (subtotal, weight) for an assignment."""
    loads: dict[str, list[float]] = {}
    for i, sid in assignment.items():
        cost = _cell_cost(required[i], matrix[i][sid])
        w = _item_weight(required[i])
        acc = loads.setdefault(sid, [0.0, 0.0])
        acc[0] += cost
        acc[1] += w
    return {sid: (v[0], v[1]) for sid, v in loads.items()}


def _plan_total(assignment: dict[int, str], required: list[RequiredItem],
                matrix: list[dict[str, Offer]], stores_by_id: dict[str, StoreInfo]) -> float:
    total = 0.0
    for sid, (sub, weight) in _store_loads(assignment, required, matrix).items():
        shipping, _, _ = _shipping_for(stores_by_id[sid], sub, weight, True)
        total += sub + shipping
    return total


def _assign_cheapest(fulfillable: list[int], allowed: set[str],
                     required: list[RequiredItem], matrix: list[dict[str, Offer]]
                     ) -> Optional[dict[int, str]]:
    assignment: dict[int, str] = {}
    for i in fulfillable:
        best_sid, best_cost = None, float("inf")
        for sid, offer in matrix[i].items():
            if sid in allowed:
                c = _cell_cost(required[i], offer)
                if c < best_cost:
                    best_sid, best_cost = sid, c
        if best_sid is None:
            return None
        assignment[i] = best_sid
    return assignment


def _local_search(assignment: dict[int, str], required: list[RequiredItem],
                  matrix: list[dict[str, Offer]], stores_by_id: dict[str, StoreInfo]) -> dict[int, str]:
    best = dict(assignment)
    best_cost = _plan_total(best, required, matrix, stores_by_id)
    improved, guard = True, 0
    while improved and guard < 200:
        improved = False
        guard += 1
        for i in list(best.keys()):
            for sid in matrix[i]:
                if sid == best[i]:
                    continue
                cand = dict(best)
                cand[i] = sid
                cost = _plan_total(cand, required, matrix, stores_by_id)
                if cost + 1e-9 < best_cost:
                    best, best_cost, improved = cand, cost, True
    return best


def _plan_to_result(assignment: dict[int, str], required: list[RequiredItem],
                    matrix: list[dict[str, Offer]], stores_by_id: dict[str, StoreInfo],
                    unavailable: list[str]) -> dict:
    groups: dict[str, dict] = {}
    items_cost = 0.0
    for i, sid in assignment.items():
        offer = matrix[i][sid]
        g = groups.setdefault(sid, {
            "store_id": sid, "store_name": stores_by_id[sid].name,
            "items": [], "subtotal": 0.0, "weight": 0.0,
        })
        g["items"].append(_line(required[i], offer))
        g["subtotal"] += _cell_cost(required[i], offer)
        g["weight"] += _item_weight(required[i])
        items_cost += _cell_cost(required[i], offer)

    group_list = sorted(groups.values(), key=lambda g: g["subtotal"], reverse=True)
    total_shipping = 0.0
    shipping_saved = 0.0
    for g in group_list:
        store = stores_by_id[g["store_id"]]
        shipping, free_ok, to_free = _shipping_for(store, g["subtotal"], g["weight"], True)
        if free_ok:
            paid, _, _ = _shipping_for(
                StoreInfo(store.id, store.name, store.shipping, None,
                          store.shipping_per_kg, store.region_multiplier),
                g["subtotal"], g["weight"], True)
            shipping_saved += paid
        g["items"].sort(key=lambda r: r["line_total"], reverse=True)
        g["subtotal"] = _r(g["subtotal"])
        g.pop("weight", None)
        g["shipping"] = shipping
        g["total"] = _r(g["subtotal"] + shipping)
        g["free_shipping_threshold"] = store.free_shipping_threshold
        g["free_shipping_eligible"] = free_ok
        g["amount_to_free_shipping"] = to_free
        total_shipping += shipping

    return {
        "groups": group_list,
        "items_cost": _r(items_cost),
        "total_shipping": _r(total_shipping),
        "total": _r(items_cost + total_shipping),
        "store_count": len(group_list),
        "shipping_saved": _r(shipping_saved),
        "unavailable": unavailable,
    }


def compute_multi(required: list[RequiredItem], offers: list[Offer],
                  stores: list[StoreInfo]) -> dict:
    stores_by_id = {s.id: s for s in stores}
    store_ids = [s.id for s in stores]
    matrix = _best_offer_matrix(required, offers)

    fulfillable = [i for i in range(len(required)) if matrix[i]]
    unavailable = [required[i].standard_name for i in range(len(required)) if not matrix[i]]
    if not fulfillable:
        return _plan_to_result({}, required, matrix, stores_by_id, unavailable)

    max_cov = len(fulfillable)
    best_assignment: Optional[dict[int, str]] = None
    best_cost = float("inf")

    if len(store_ids) <= MAX_ENUM_STORES:
        for k in range(1, len(store_ids) + 1):
            for subset in combinations(store_ids, k):
                allowed = set(subset)
                assignment = _assign_cheapest(fulfillable, allowed, required, matrix)
                if assignment is None or len(assignment) != max_cov:
                    continue
                cost = _plan_total(assignment, required, matrix, stores_by_id)
                if cost < best_cost:
                    best_assignment, best_cost = assignment, cost
    if best_assignment is None:
        best_assignment = _assign_cheapest(fulfillable, set(store_ids), required, matrix)

    best_assignment = _local_search(best_assignment, required, matrix, stores_by_id)
    return _plan_to_result(best_assignment, required, matrix, stores_by_id, unavailable)


# ---------------------------------------------------------------------------
# Top level
# ---------------------------------------------------------------------------
def _empty_multi() -> dict:
    return {"groups": [], "items_cost": 0.0, "total_shipping": 0.0, "total": 0.0,
            "store_count": 0, "shipping_saved": 0.0, "unavailable": []}


def optimize(required: list[RequiredItem], offers: list[Offer],
             stores: list[StoreInfo]) -> dict:
    if not required:
        return {"single": {"ranking": [], "best": None, "cheapest_complete": None},
                "multi": _empty_multi(), "base_single_total": 0.0,
                "savings": 0.0, "recommend": "single"}

    ranking = compute_single(required, offers, stores)
    multi = compute_multi(required, offers, stores)

    best_single = ranking[0] if ranking else None
    complete = [r for r in ranking if r["complete"]]
    cheapest_complete = min(complete, key=lambda r: r["total"]) if complete else None

    base = cheapest_complete or best_single
    base_total = base["total"] if base else 0.0
    savings = _r(base_total - multi["total"]) if base else 0.0
    recommend = "multi" if savings > RECOMMEND_THRESHOLD else "single"

    return {
        "single": {"ranking": ranking, "best": best_single, "cheapest_complete": cheapest_complete},
        "multi": multi,
        "base_single_total": base_total,
        "savings": savings,
        "recommend": recommend,
    }
