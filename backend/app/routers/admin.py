"""Internal admin: product-match review queue and scraper health.

These surface the trust machinery (P2/P3): a human resolves ambiguous matches,
and a health dashboard makes a broken scraper visible (zero-result / error runs)
instead of silently degrading results.
"""
from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.database import get_db
from app.models import ProductCache, ProductMatchReview, ScrapeRun, Store
from app.schemas import ReviewOut, ReviewResolve, ScraperHealth, StoreHealth

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_admin)])


@router.get("/reviews", response_model=list[ReviewOut])
def list_reviews(status_filter: str = Query("pending", alias="status"),
                 limit: int = Query(100, le=500), db: Session = Depends(get_db)):
    return (db.query(ProductMatchReview)
            .filter(ProductMatchReview.status == status_filter)
            .order_by(ProductMatchReview.created_at.desc())
            .limit(limit).all())


@router.post("/reviews/{review_id}/resolve", response_model=ReviewOut)
def resolve_review(review_id: int, payload: ReviewResolve, db: Session = Depends(get_db)):
    review = db.get(ProductMatchReview, review_id)
    if review is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Revisão não encontrada.")

    if payload.approve:
        canonical = payload.canonical_name or review.candidate_name
        review.status = "approved"
        review.resolved_canonical = canonical
        # Promote the matching cached offers to trusted with the confirmed name.
        offers = (db.query(ProductCache)
                  .filter(ProductCache.store_id == review.store_id,
                          ProductCache.title == review.title).all())
        for o in offers:
            o.standard_name = canonical
            o.needs_review = False
            o.match_method = "human"
            o.confidence = 1.0
    else:
        review.status = "rejected"
        offers = (db.query(ProductCache)
                  .filter(ProductCache.store_id == review.store_id,
                          ProductCache.title == review.title).all())
        for o in offers:
            o.in_stock = False  # keep it out of results
    db.commit()
    db.refresh(review)
    return review


@router.get("/scraper-health", response_model=ScraperHealth)
def scraper_health(window_hours: int = Query(24, ge=1, le=168), db: Session = Depends(get_db)):
    since = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=window_hours)
    runs = db.query(ScrapeRun).filter(ScrapeRun.created_at >= since).all()

    by_store: dict[str, list] = {}
    for r in runs:
        by_store.setdefault(r.store_id, []).append(r)

    # Include known stores even with no runs (so silence is visible too).
    for s in db.query(Store).all():
        by_store.setdefault(s.id, [])

    out: list[StoreHealth] = []
    for store_id, store_runs in sorted(by_store.items()):
        total = len(store_runs)
        ok = sum(1 for r in store_runs if r.status == "ok")
        empty = sum(1 for r in store_runs if r.status == "empty")
        error = sum(1 for r in store_runs if r.status == "error")
        last_ok = max((r.created_at for r in store_runs if r.status == "ok"), default=None)
        store = db.get(Store, store_id)
        out.append(StoreHealth(
            store_id=store_id, runs=total, ok=ok, empty=empty, error=error,
            success_rate=round(ok / total, 3) if total else 0.0,
            empty_rate=round(empty / total, 3) if total else 0.0,
            last_success_at=last_ok.isoformat() if last_ok else None,
            status=(store.status if store else "unknown"),
        ))
    return ScraperHealth(window_hours=window_hours, stores=out)
