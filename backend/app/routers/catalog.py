"""Catálogo canônico exposto para o cliente (PWA) sincronizar dinamicamente.

Serve o catálogo no MESMO formato que o frontend usa (id/std/cat/kw/brands+prices),
e um hash barato para o cliente detectar mudanças sem baixar tudo toda vez.
"""
from __future__ import annotations

import hashlib
import json

from fastapi import APIRouter

from app.services.catalog import CATALOG, STORES, NO_ESTIMATE, OUT_OF_STOCK

router = APIRouter(prefix="/catalog", tags=["Catalog"])


def _build_catalog() -> list[dict]:
    """Expande o CATALOG para o shape do frontend: preços por loja = base × factor."""
    items: list[dict] = []
    for prod in CATALOG:
        estimate = prod.id not in NO_ESTIMATE
        brands = []
        for brand in prod.brands:
            prices: dict[str, float] = {}
            if estimate:
                for store in STORES:
                    if (prod.id, store["id"]) in OUT_OF_STOCK:
                        continue
                    prices[store["id"]] = round(brand.base_price * store["factor"], 2)
            brands.append({"name": brand.name, "prices": prices})
        items.append({
            "id": prod.id,
            "std": prod.standard_name,
            "cat": prod.category,
            "kw": list(prod.keywords),
            "brands": brands,
        })
    return items


def _payload() -> tuple[list[dict], str]:
    items = _build_catalog()
    blob = json.dumps(items, sort_keys=True, ensure_ascii=False)
    digest = hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]
    return items, digest


@router.get("")
def get_catalog() -> dict:
    """Catálogo completo + hash (o cliente cacheia em IndexedDB)."""
    items, digest = _payload()
    return {"hash": digest, "count": len(items), "items": items}


@router.get("/hash")
def get_catalog_hash() -> dict:
    """Só o hash — o cliente compara com o cache antes de baixar o catálogo inteiro."""
    _, digest = _payload()
    return {"hash": digest}
