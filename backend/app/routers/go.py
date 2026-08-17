"""Outbound affiliate redirect with click tracking (monetization funnel).

GET /go/{offer_id} records the click and 302-redirects to the store's tracked
(affiliate) URL. The frontend's "Ir para a loja" points here so every hand-off
is measurable and monetizable.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Click, ProductCache, Store
from app.services.affiliate import build_affiliate_url

router = APIRouter(prefix="/go", tags=["Outbound"])


@router.get("/{offer_id}")
def go(offer_id: int, request: Request, list_id: int | None = None,
       db: Session = Depends(get_db)):
    offer = db.get(ProductCache, offer_id)
    if offer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Oferta não encontrada.")
    store = db.get(Store, offer.store_id)
    target = build_affiliate_url(store, offer.url)

    db.add(Click(offer_id=offer.id, store_id=offer.store_id,
                 standard_name=offer.standard_name, list_id=list_id, url=target))
    db.commit()
    return RedirectResponse(target, status_code=status.HTTP_302_FOUND)
