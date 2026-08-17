"""Celery tasks: scraping orchestration with telemetry, health, and a watchdog.

Per item we run the active scrapers, record a ScrapeRun (ok/empty/error) so a
broken selector surfaces as a zero-result alert instead of a silent empty cart,
recompute each store's health, upsert trusted offers (queuing ambiguous matches
for human review), and bump the job's progress. A watchdog reaps stuck jobs.
"""
from __future__ import annotations

import datetime as dt
import logging
import time

from sqlalchemy import func, update

from app.core.config import settings
from app.database import SessionLocal
from app.models import (
    ExtractedItem, Job, ProductCache, ProductMatchReview, ScrapeRun, Store, SupplyList,
)
from worker.celery_app import app
from worker.scrapers.registry import get_scrapers

log = logging.getLogger("tasks")

STUCK_JOB_MINUTES = 15
HEALTH_WINDOW = 20
DEGRADED_SUCCESS_RATE = 0.5


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _is_fresh(db, standard_name: str) -> bool:
    cutoff = _now() - dt.timedelta(hours=settings.CACHE_TTL_HOURS)
    return (db.query(ProductCache)
            .filter(ProductCache.standard_name == standard_name,
                    ProductCache.last_updated >= cutoff,
                    ProductCache.needs_review.is_(False))
            .first() is not None)


def _ensure_store(db, store_id: str, name: str | None = None) -> None:
    if db.get(Store, store_id) is None:
        db.add(Store(id=store_id, name=name or store_id.title(), shipping_cost=0.0, active=True))
        db.commit()


def _queue_review(db, offer) -> None:
    exists = (db.query(ProductMatchReview)
              .filter(ProductMatchReview.store_id == offer.store_id,
                      ProductMatchReview.title == offer.title,
                      ProductMatchReview.status == "pending")
              .first())
    if exists is None:
        db.add(ProductMatchReview(
            store_id=offer.store_id, title=offer.title, ean=offer.ean,
            candidate_id=None, candidate_name=offer.standard_name,
            confidence=offer.confidence, status="pending"))
        db.commit()


def _upsert_offer(db, offer) -> None:
    _ensure_store(db, offer.store_id, getattr(offer, "store_name", None))
    row = (db.query(ProductCache)
           .filter(ProductCache.store_id == offer.store_id,
                   ProductCache.standard_name == offer.standard_name,
                   ProductCache.brand == offer.brand)
           .first())
    if row is None:
        db.add(ProductCache(
            store_id=offer.store_id, standard_name=offer.standard_name, brand=offer.brand,
            title=offer.title, ean=offer.ean, price=offer.price, url=offer.url,
            image_url=offer.image_url, in_stock=offer.in_stock, confidence=offer.confidence,
            match_method=offer.match_method, needs_review=offer.needs_review,
            source=offer.source, pack_qty=getattr(offer, 'pack_qty', 1),
            unit_price=getattr(offer, 'unit_price', None), currency="BRL"))
    else:
        row.price, row.url, row.image_url = offer.price, offer.url, offer.image_url
        row.title, row.ean = offer.title, offer.ean
        row.confidence, row.match_method = offer.confidence, offer.match_method
        row.needs_review, row.source = offer.needs_review, offer.source
        row.pack_qty = getattr(offer, 'pack_qty', 1)
        row.unit_price = getattr(offer, 'unit_price', None)
        row.in_stock, row.last_updated = offer.in_stock, _now()
    db.commit()
    if offer.needs_review:
        _queue_review(db, offer)


def _recompute_health(db, store_id: str) -> None:
    runs = (db.query(ScrapeRun).filter(ScrapeRun.store_id == store_id)
            .order_by(ScrapeRun.created_at.desc()).limit(HEALTH_WINDOW).all())
    if not runs:
        return
    ok = sum(1 for r in runs if r.status == "ok")
    rate = ok / len(runs)
    store = db.get(Store, store_id)
    if store:
        store.status = "degraded" if rate < DEGRADED_SUCCESS_RATE else "ok"
        db.commit()


def _log_run(db, store_id, query, status, count, error, duration_ms) -> None:
    db.add(ScrapeRun(store_id=store_id, query=query, status=status,
                     results_count=count, error=error, duration_ms=duration_ms))
    db.commit()
    _recompute_health(db, store_id)


def _bump_job(db, list_id: int) -> None:
    db.execute(update(Job).where(Job.list_id == list_id)
               .values(completed_items=Job.completed_items + 1, updated_at=func.now()))
    db.commit()


@app.task(bind=True, max_retries=2, name="worker.tasks.scrape_item")
def scrape_item(self, list_id: int, standard_name: str) -> str:
    db = SessionLocal()
    try:
        if _is_fresh(db, standard_name):
            log.info("cache hit", extra={"extra_fields": {"item": standard_name}})
            _bump_job(db, list_id)
            return standard_name

        for scraper in get_scrapers():
            t0 = time.monotonic()
            store_id = getattr(scraper, "store_id", "?")
            try:
                offers = scraper.scrape([standard_name])
                for offer in offers:
                    _upsert_offer(db, offer)
                dur = int((time.monotonic() - t0) * 1000)
                if offers:
                    _log_run(db, store_id, standard_name, "ok", len(offers), None, dur)
                else:
                    # Zero results where we expected some => likely broken selector.
                    _log_run(db, store_id, standard_name, "empty", 0, None, dur)
                    log.warning("scraper returned zero results",
                                extra={"extra_fields": {"store": store_id, "item": standard_name}})
            except Exception as exc:  # noqa: BLE001
                dur = int((time.monotonic() - t0) * 1000)
                _log_run(db, store_id, standard_name, "error", 0, str(exc)[:500], dur)
                log.error("scraper error",
                          extra={"extra_fields": {"store": store_id, "item": standard_name}}, exc_info=exc)
        _bump_job(db, list_id)
        return standard_name
    finally:
        db.close()


@app.task(name="worker.tasks.finalize_list")
def finalize_list(_results, list_id: int) -> dict:
    db = SessionLocal()
    try:
        db.execute(update(Job).where(Job.list_id == list_id)
                   .values(status="done", updated_at=func.now()))
        db.execute(update(SupplyList).where(SupplyList.id == list_id).values(status="ready"))
        db.commit()
        log.info("list ready", extra={"extra_fields": {"list_id": list_id}})
        return {"list_id": list_id, "status": "ready"}
    finally:
        db.close()


@app.task(name="worker.tasks.process_list")
def process_list(list_id: int) -> dict:
    from celery import chord

    db = SessionLocal()
    try:
        from app.seed import seed_stores
        seed_stores(db)  # idempotent; ensures FK targets exist for the worker

        names = sorted({i.standard_name for i in
                        db.query(ExtractedItem).filter(ExtractedItem.list_id == list_id).all()})
        db.execute(update(Job).where(Job.list_id == list_id)
                   .values(status="processing", total_items=len(names),
                           completed_items=0, updated_at=func.now()))
        db.execute(update(SupplyList).where(SupplyList.id == list_id).values(status="processing"))
        db.commit()
    finally:
        db.close()

    if not names:
        return finalize_list.run(None, list_id)

    chord((scrape_item.s(list_id, name) for name in names))(finalize_list.s(list_id))
    return {"list_id": list_id, "queued": len(names)}


@app.task(name="worker.tasks.reap_stuck_jobs")
def reap_stuck_jobs() -> dict:
    """Watchdog: fail jobs stuck in processing (e.g. a dropped chord)."""
    db = SessionLocal()
    try:
        cutoff = _now() - dt.timedelta(minutes=STUCK_JOB_MINUTES)
        stuck = (db.query(Job)
                 .filter(Job.status.in_(["pending", "processing"]), Job.updated_at < cutoff)
                 .all())
        for job in stuck:
            job.status = "error"
            job.error = "timeout: scraping did not finish"
            db.execute(update(SupplyList).where(SupplyList.id == job.list_id).values(status="error"))
        db.commit()
        return {"reaped": len(stuck)}
    finally:
        db.close()


@app.task(name="worker.tasks.refresh_stale_cache")
def refresh_stale_cache() -> dict:
    db = SessionLocal()
    try:
        cutoff = _now() - dt.timedelta(hours=settings.CACHE_TTL_HOURS)
        names = [r[0] for r in db.query(ProductCache.standard_name)
                 .filter(ProductCache.last_updated < cutoff).distinct().all()]
    finally:
        db.close()
    for name in names:
        db = SessionLocal()
        try:
            for scraper in get_scrapers():
                for offer in scraper.scrape([name]):
                    _upsert_offer(db, offer)
        except Exception as exc:  # noqa: BLE001
            log.warning("refresh error", extra={"extra_fields": {"item": name}}, exc_info=exc)
        finally:
            db.close()
    return {"refreshed": len(names)}
