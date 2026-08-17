"""Bridge between the database and the pure optimizer.

Builds optimizer inputs from the reviewed list and *trusted* cached offers:
  * excludes owned items and low-confidence matches (needs_review);
  * carries per-listing pack size + per-unit price so packs are bought whole;
  * resolves the destination CEP to a regional multiplier and attaches per-store
    per-kg rates + per-product weights, so freight reflects where the student
    lives and how heavy the order is;
  * carries price freshness (age in hours) through to the optimizer.
"""
from __future__ import annotations

import datetime as dt

from sqlalchemy.orm import Session

from app.models import ExtractedItem, ProductCache, Store, SupplyList
from app.services.catalog import DEFAULT_WEIGHT_G, WEIGHT_BY_STD
from app.services.optimizer import Offer, RequiredItem, StoreInfo, optimize
from app.services.shipping import region_from_cep, region_multiplier


def _age_hours(ts: dt.datetime | None) -> float | None:
    if ts is None:
        return None
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=dt.timezone.utc)
    return round((dt.datetime.now(dt.timezone.utc) - ts).total_seconds() / 3600, 1)


def _weight(standard_name: str) -> float:
    return WEIGHT_BY_STD.get(standard_name, DEFAULT_WEIGHT_G)


def _build_inputs(db: Session, list_id: int, cep: str | None):
    items = (db.query(ExtractedItem)
             .filter(ExtractedItem.list_id == list_id, ExtractedItem.owned.is_(False))
             .all())
    required = [RequiredItem(standard_name=i.standard_name, brand=i.brand,
                             quantity=i.quantity or 1, weight_g=_weight(i.standard_name))
                for i in items]

    names = {i.standard_name for i in items}
    offers_db = (db.query(ProductCache)
                 .filter(ProductCache.standard_name.in_(names),
                         ProductCache.in_stock.is_(True),
                         ProductCache.needs_review.is_(False))
                 .all()) if names else []
    offers = [Offer(standard_name=o.standard_name, store_id=o.store_id, price=o.price,
                    brand=o.brand, url=o.url, in_stock=o.in_stock,
                    age_hours=_age_hours(o.last_updated), offer_id=o.id,
                    pack_qty=o.pack_qty or 1, unit_price=o.unit_price,
                    image_url=o.image_url)
              for o in offers_db]

    mult = region_multiplier(cep)
    store_ids = {o.store_id for o in offers_db}
    stores_db = (db.query(Store).filter(Store.id.in_(store_ids)).all()
                 if store_ids else db.query(Store).filter(Store.active.is_(True)).all())
    stores = [StoreInfo(id=s.id, name=s.name, shipping=s.shipping_cost,
                        free_shipping_threshold=s.free_shipping_threshold,
                        shipping_per_kg=s.shipping_per_kg or 0.0,
                        region_multiplier=mult)
              for s in stores_db]

    return required, offers, stores


def optimize_list(db: Session, list_id: int, cep: str | None = None) -> dict:
    if cep is None:
        supply = db.get(SupplyList, list_id)
        cep = supply.cep if supply else None
    required, offers, stores = _build_inputs(db, list_id, cep)
    result = optimize(required, offers, stores)
    result["destination_region"] = region_from_cep(cep)
    return result
