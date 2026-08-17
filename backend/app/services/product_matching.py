"""
Match a real store listing to a canonical product — the hard problem.

Standardizing a student's messy line is easy; deciding that the listing
"Sonda Exploradora Nº 5 Duflex Ref 1234" on a store is our canonical
"Sonda Exploradora nº 5" — with a confidence we can trust — is where accuracy
lives. Strategy:

  1. EAN/GTIN exact match  -> confidence 1.0 (the reliable key).
  2. Token-set similarity between the listing title and each canonical product's
     signature (distinctive keywords + name tokens + brand), producing a 0..1
     score. Brand is treated as a structured attribute, not free text.

Decision bands:
  score >= ACCEPT            -> auto-accept
  REVIEW <= score < ACCEPT   -> accept but flag for human review
  top two within AMBIGUOUS    -> flag for review even if high (kits/combos)
  score <  REVIEW            -> no match (better a gap than a wrong price)

Pure standard library; fully unit-tested.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from app.services.catalog import CATALOG, EAN_TO_ID, CATALOG_BY_ID
from app.services.matcher import normalize

ACCEPT = 0.78
REVIEW = 0.55
AMBIGUOUS = 0.10

_STOP = {"de", "da", "do", "para", "com", "e", "ou", "a", "o", "kit"}
_KNOWN_BRANDS = ("3M", "FGM", "Golgran", "Duflex", "Quinelato", "SS White",
                 "KG Sorensen", "ABC", "Madeitex", "Shalon")


@dataclass(frozen=True)
class MatchCandidate:
    canonical_id: str
    standard_name: str
    confidence: float
    method: str            # "ean" | "similarity"
    needs_review: bool


def _name_tokens(standard_name: str) -> set[str]:
    return {t for t in normalize(standard_name).split() if t not in _STOP}


def _detect_brand(title_norm: str) -> Optional[str]:
    for b in _KNOWN_BRANDS:
        toks = normalize(b).split()
        if all(t in title_norm for t in toks):
            return b
    return None


def _score(title_norm: str, title_toks: set[str], detected_brand: Optional[str],
           product) -> float:
    kw = product.keywords
    kw_hits = sum(1 for k in kw if k in title_norm) / len(kw) if kw else 0.0

    name_toks = _name_tokens(product.standard_name)
    overlap = len(title_toks & name_toks) / len(name_toks) if name_toks else 0.0

    brand_names = {b.name for b in product.brands}
    brand_hit = 1.0 if (detected_brand and detected_brand in brand_names) else 0.0

    return 0.55 * kw_hits + 0.30 * overlap + 0.15 * brand_hit


def match_product(title: str, brand: Optional[str] = None,
                  ean: Optional[str] = None) -> Optional[MatchCandidate]:
    """Return the best canonical match for a listing, or None if not confident."""
    # 1) EAN is authoritative.
    if ean:
        cid = EAN_TO_ID.get(str(ean).strip())
        if cid:
            p = CATALOG_BY_ID[cid]
            return MatchCandidate(cid, p.standard_name, 1.0, "ean", needs_review=False)

    # 2) Similarity.
    title_norm = normalize(title)
    title_toks = set(title_norm.split())
    detected_brand = brand if (brand in {b for p in CATALOG for b in
                                         {br.name for br in p.brands}}) else _detect_brand(title_norm)

    scored = sorted(
        ((_score(title_norm, title_toks, detected_brand, p), p) for p in CATALOG),
        key=lambda t: t[0], reverse=True,
    )
    best_score, best = scored[0]
    if best_score < REVIEW:
        return None

    second = scored[1][0] if len(scored) > 1 else 0.0
    ambiguous = (best_score - second) < AMBIGUOUS and second >= REVIEW
    needs_review = ambiguous or best_score < ACCEPT

    return MatchCandidate(best.id, best.standard_name, round(best_score, 3),
                          "similarity", needs_review=needs_review)
