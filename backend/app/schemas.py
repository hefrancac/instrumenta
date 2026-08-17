"""Pydantic v2 request/response schemas (v2)."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ------------------------------- Auth ---------------------------------
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ------------------------------- Items --------------------------------
class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    raw_name: str
    standard_name: str
    category: str
    brand: Optional[str] = None
    quantity: int = 1
    owned: bool = False


class ItemUpdate(BaseModel):
    brand: Optional[str] = None
    owned: Optional[bool] = None
    quantity: Optional[int] = Field(default=None, ge=1, le=99)


# ------------------------------ Upload --------------------------------
class TextUploadRequest(BaseModel):
    text: str = Field(min_length=1)


class UploadResponse(BaseModel):
    list_id: int
    status: str
    item_count: int
    items: list[ItemOut]


class JobStatus(BaseModel):
    list_id: int
    status: str
    total_items: int
    completed_items: int
    progress: float


class ListDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    status: str
    items: list[ItemOut]


class ShareResponse(BaseModel):
    token: str
    share_url: str


# --------------------------- Optimizer --------------------------------
class OfferRow(BaseModel):
    standard_name: str
    brand: Optional[str] = None
    quantity: int = 1
    pack_qty: int = 1
    packs: int = 1
    unit_price: float
    unit_listing_price: Optional[float] = None
    line_total: float
    price: float                      # == line_total (back-compat)
    url: Optional[str] = None
    offer_id: Optional[int] = None
    age_hours: Optional[float] = None
    image_url: Optional[str] = None


class SingleStoreOption(BaseModel):
    store_id: str
    store_name: str
    coverage: int
    required_count: int
    complete: bool
    subtotal: float
    shipping: float
    total: float
    free_shipping_threshold: Optional[float] = None
    free_shipping_eligible: bool = False
    amount_to_free_shipping: Optional[float] = None
    items: list[OfferRow]
    missing: list[str]


class SingleSection(BaseModel):
    ranking: list[SingleStoreOption]
    best: Optional[SingleStoreOption] = None
    cheapest_complete: Optional[SingleStoreOption] = None


class MultiGroup(BaseModel):
    store_id: str
    store_name: str
    shipping: float
    subtotal: float
    total: float
    free_shipping_threshold: Optional[float] = None
    free_shipping_eligible: bool = False
    amount_to_free_shipping: Optional[float] = None
    items: list[OfferRow]


class MultiResult(BaseModel):
    groups: list[MultiGroup]
    items_cost: float
    total_shipping: float
    total: float
    store_count: int
    shipping_saved: float = 0.0
    unavailable: list[str]


class OptimizeResponse(BaseModel):
    single: SingleSection
    multi: MultiResult
    base_single_total: float
    savings: float
    recommend: str  # "single" | "multi"
    destination_region: Optional[str] = None


# --------------------------- Admin ------------------------------------
class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    store_id: str
    title: str
    ean: Optional[str] = None
    candidate_id: Optional[str] = None
    candidate_name: Optional[str] = None
    confidence: Optional[float] = None
    status: str


class ReviewResolve(BaseModel):
    approve: bool
    canonical_name: Optional[str] = None  # override the proposed match when approving


class StoreHealth(BaseModel):
    store_id: str
    runs: int
    ok: int
    empty: int
    error: int
    success_rate: float
    empty_rate: float
    last_success_at: Optional[str] = None
    status: str


class ScraperHealth(BaseModel):
    window_hours: int
    stores: list[StoreHealth]
