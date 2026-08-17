"""SQLAlchemy models (v2).

Adds the data behind the four upgrades:
  * Store: free-shipping threshold + affiliate config + health status (P1, P3, P4).
  * ExtractedItem: quantity (P4).
  * ProductCache: listing title, EAN, match confidence/method, needs_review, source (P2, P3).
  * SupplyList: share token for public read-only links (P4).
  * ProductMatchReview: human-review queue for ambiguous matches (P2).
  * ScrapeRun: per-run scraper telemetry for monitoring/alerts (P3).
  * Click: outbound affiliate click tracking (P4).
"""
from __future__ import annotations

import datetime as dt

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer, String,
    UniqueConstraint, func,
)
from sqlalchemy.orm import relationship

from app.database import Base


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    lists = relationship("SupplyList", back_populates="user", cascade="all, delete-orphan")


class Store(Base):
    __tablename__ = "stores"
    id = Column(String(40), primary_key=True)
    name = Column(String(120), nullable=False)
    shipping_cost = Column(Float, default=0.0, nullable=False)
    free_shipping_threshold = Column(Float, nullable=True)     # None => never free
    shipping_per_kg = Column(Float, default=0.0, nullable=False)
    base_url = Column(String(255))
    affiliate_tag = Column(String(120), nullable=True)
    affiliate_template = Column(String(500), nullable=True)    # optional URL template
    active = Column(Boolean, default=True, nullable=False)
    status = Column(String(20), default="ok", nullable=False)  # ok | degraded (from ScrapeRun)
    offers = relationship("ProductCache", back_populates="store", cascade="all, delete-orphan")


class SupplyList(Base):
    __tablename__ = "supply_lists"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status = Column(String(20), default="pending", nullable=False)
    share_token = Column(String(48), unique=True, index=True, nullable=True)
    is_public = Column(Boolean, default=False, nullable=False)
    cep = Column(String(9), nullable=True)  # destination for freight estimation
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    user = relationship("User", back_populates="lists")
    items = relationship("ExtractedItem", back_populates="supply_list", cascade="all, delete-orphan")
    job = relationship("Job", back_populates="supply_list", uselist=False, cascade="all, delete-orphan")


class ExtractedItem(Base):
    __tablename__ = "extracted_items"
    id = Column(Integer, primary_key=True, index=True)
    list_id = Column(Integer, ForeignKey("supply_lists.id", ondelete="CASCADE"), index=True)
    raw_name = Column(String(255), nullable=False)
    standard_name = Column(String(255), index=True, nullable=False)
    category = Column(String(40), default="Material")
    brand = Column(String(120), nullable=True)
    quantity = Column(Integer, default=1, nullable=False)
    owned = Column(Boolean, default=False, nullable=False)
    supply_list = relationship("SupplyList", back_populates="items")


class ProductCache(Base):
    __tablename__ = "product_cache"
    __table_args__ = (UniqueConstraint("store_id", "standard_name", "brand", name="uq_offer"),)
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(String(40), ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    standard_name = Column(String(255), index=True, nullable=False)
    brand = Column(String(120), nullable=True)
    title = Column(String(500), nullable=True)               # raw listing title seen at the store
    ean = Column(String(20), index=True, nullable=True)
    pack_qty = Column(Integer, default=1, nullable=False)   # base units per listing
    unit_price = Column(Float, nullable=True)               # price / pack_qty
    price = Column(Float, nullable=False)
    currency = Column(String(8), default="BRL", nullable=False)
    url = Column(String(500))
    image_url = Column(String(500))
    in_stock = Column(Boolean, default=True, nullable=False)
    confidence = Column(Float, default=1.0, nullable=False)   # match confidence
    match_method = Column(String(20), default="seed", nullable=False)  # ean|similarity|seed
    needs_review = Column(Boolean, default=False, nullable=False)      # excluded from results if True
    source = Column(String(20), default="scrape", nullable=False)      # scrape|feed|seed
    last_updated = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow,
                          index=True, nullable=False)
    store = relationship("Store", back_populates="offers")


class Job(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True, index=True)
    list_id = Column(Integer, ForeignKey("supply_lists.id", ondelete="CASCADE"),
                     unique=True, index=True)
    status = Column(String(20), default="pending", nullable=False)  # pending|processing|done|error
    total_items = Column(Integer, default=0, nullable=False)
    completed_items = Column(Integer, default=0, nullable=False)
    error = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)
    supply_list = relationship("SupplyList", back_populates="job")

    @property
    def progress(self) -> float:
        return round(self.completed_items / self.total_items, 3) if self.total_items else 0.0


class ProductMatchReview(Base):
    """Ambiguous / low-confidence store matches awaiting human confirmation."""
    __tablename__ = "product_match_reviews"
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(String(40), index=True)
    title = Column(String(500), nullable=False)
    ean = Column(String(20), nullable=True)
    candidate_id = Column(String(80), nullable=True)       # proposed canonical id
    candidate_name = Column(String(255), nullable=True)
    confidence = Column(Float, nullable=True)
    status = Column(String(20), default="pending", nullable=False)  # pending|approved|rejected
    resolved_canonical = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, index=True, nullable=False)


class ScrapeRun(Base):
    """One scraper execution — telemetry for monitoring and alerting."""
    __tablename__ = "scrape_runs"
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(String(40), index=True, nullable=False)
    query = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False)            # ok | empty | error
    results_count = Column(Integer, default=0, nullable=False)
    error = Column(String(500), nullable=True)
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, index=True, nullable=False)


class Click(Base):
    """Outbound affiliate click — conversion funnel tracking."""
    __tablename__ = "clicks"
    id = Column(Integer, primary_key=True, index=True)
    offer_id = Column(Integer, ForeignKey("product_cache.id", ondelete="SET NULL"), nullable=True)
    store_id = Column(String(40), index=True)
    standard_name = Column(String(255))
    list_id = Column(Integer, nullable=True)
    user_id = Column(Integer, nullable=True)
    url = Column(String(700))
    created_at = Column(DateTime(timezone=True), default=_utcnow, index=True, nullable=False)
