"""Seed stores and demo offers so the pipeline returns real results in dev.

Run standalone:  python -m app.seed
Also invoked on startup when SEED_ON_STARTUP is true and the cache is empty.
"""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import ProductCache, Store
from app.services.catalog import STORES, generate_offers

log = logging.getLogger("seed")


def seed_stores(db: Session) -> None:
    for s in STORES:
        store = db.get(Store, s["id"])
        if store is None:
            db.add(Store(id=s["id"], name=s["name"], shipping_cost=s["shipping"],
                         shipping_per_kg=s.get("ship_per_kg", 0.0),
                         free_shipping_threshold=s["free_shipping"], base_url=s["base_url"],
                         affiliate_tag=s.get("affiliate_tag"), active=True, status="ok"))
        else:
            store.name = s["name"]
            store.shipping_cost = s["shipping"]
            store.shipping_per_kg = s.get("ship_per_kg", 0.0)
            store.free_shipping_threshold = s["free_shipping"]
            store.base_url = s["base_url"]
            store.affiliate_tag = s.get("affiliate_tag")
    db.commit()


def seed_offers(db: Session, force: bool = False) -> int:
    if not force and db.query(ProductCache).first() is not None:
        return 0
    db.query(ProductCache).delete()
    offers = generate_offers()
    for o in offers:
        db.add(ProductCache(
            store_id=o.store_id, standard_name=o.standard_name, brand=o.brand,
            title=o.title, ean=o.ean, price=o.price, url=o.url, in_stock=o.in_stock,
            pack_qty=o.pack_qty, unit_price=o.unit_price,
            confidence=1.0, match_method="seed", needs_review=False, source="seed",
            currency="BRL"))
    db.commit()
    return len(offers)


def run(force: bool = False) -> None:
    db = SessionLocal()
    try:
        seed_stores(db)
        n = seed_offers(db, force=force)
        log.info("Seed complete", extra={"extra_fields": {"offers": n}})
        print(f"Seeded {len(STORES)} stores and {n} offers.")
    finally:
        db.close()


if __name__ == "__main__":
    import sys
    run(force="--force" in sys.argv)
