"""
Local, deterministic name matcher.

Maps each raw line from a student's list to a canonical catalog entry using
accent-insensitive keyword scoring. This is used as:
  * the offline fallback when no LLM key is configured, and
  * a sanity net around the LLM output (LLM proposes, matcher validates the
    proposed standard_name exists in the taxonomy).

Pure standard library so it can be unit-tested without the app stack.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Optional

from app.services.catalog import CATALOG, ProductDef, cheapest_brand


_WS = re.compile(r"\s+")
_PUNCT = re.compile(r"[^a-z0-9\s]")
_SPLIT = re.compile(r"[\n;]+")               # line-based; commas are kept (e.g. "nº 24, 36")
_BULLET = re.compile(r"^[\s•\-–—\*·•]+")
_QTY_PAREN = re.compile(r"\(\s*(\d+)\s*(?:de cada|un|und|unid|x|pç|pcs)?\s*\)", re.I)


def normalize(text: str) -> str:
    """lowercase, strip accents, drop punctuation, collapse whitespace."""
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = _PUNCT.sub(" ", text)
    return _WS.sub(" ", text).strip()


def _clean_display(line: str) -> str:
    """Strip leading bullets and trailing quantity notes for a tidy item name."""
    s = _BULLET.sub("", line)
    s = _QTY_PAREN.sub("", s)
    return _WS.sub(" ", s).strip(" -–—:\t")


def _parse_qty(line: str) -> int:
    """Read a quantity from a '(N)' / '(N de cada)' note; default 1."""
    m = _QTY_PAREN.search(line)
    if m:
        return min(99, max(1, int(m.group(1))))
    return 1


def _is_header(line: str) -> bool:
    """Section headers like 'Prótese:', 'Endodontia:' — not items."""
    return line.rstrip().endswith(":")


def _is_noise(clean: str) -> bool:
    """Too short / codes-only fragments aren't searchable items."""
    return len(re.findall(r"[a-zA-ZÀ-ÿ]", clean)) < 3


@dataclass
class MatchedItem:
    catalog_id: str
    raw_name: str
    standard_name: str
    category: str
    brands: list[str]
    default_brand: str
    quantity: int = 1
    known: bool = True          # False = recognized from the list but not in the catalog yet


@dataclass
class MatchResult:
    matched: list[MatchedItem] = field(default_factory=list)
    unmatched: list[str] = field(default_factory=list)


def _best_catalog_match(line_norm: str) -> Optional[ProductDef]:
    best: Optional[ProductDef] = None
    best_score = 0
    for prod in CATALOG:
        score = sum(1 for kw in prod.keywords if kw in line_norm)
        if score > best_score:
            best_score, best = score, prod
    return best if best_score > 0 else None


def match_list(raw_text: str, keep_unmatched: bool = False) -> MatchResult:
    """Split a free-text list into lines and map each to the catalog.

    With ``keep_unmatched=True`` (used by the real upload pipeline), lines that
    don't map to the fixed catalog are still kept as *recognized* items (marked
    ``known=False``) instead of being dropped — so coverage isn't capped at the
    catalog size. Section headers and non-item fragments are skipped.

    De-duplication is per *line*, not per product: two different lines that map
    to the same catalog entry (e.g. "lima #08" and "lima #10") are both kept —
    only an exact repeat of the same line is dropped.
    """
    def _mk(prod: ProductDef, raw: str, qty: int) -> MatchedItem:
        return MatchedItem(catalog_id=prod.id, raw_name=raw, standard_name=prod.standard_name,
                           category=prod.category, brands=[b.name for b in prod.brands],
                           default_brand=cheapest_brand(prod).name, quantity=qty)

    result = MatchResult()
    seen: set[str] = set()
    context = ""    # a header/product line whose name bare model codes below inherit
    for line in _SPLIT.split(raw_text):
        line = line.strip()
        if not line:
            continue
        if _is_header(line):
            context = line.rstrip(":").strip()      # "Pontas diamantadas ...:" sets context
            continue
        clean = _clean_display(line)
        prod = _best_catalog_match(normalize(line))

        # A bare model code ("-4138F") inherits the header/product named above it,
        # so "Pontas diamantadas ...:" + "-4138F" resolves to the diamond-point item.
        if prod is None and context and _is_noise(clean) and any(c.isdigit() for c in clean):
            combo = normalize(f"{context} {clean}")
            if combo in seen:
                continue
            ctx_prod = _best_catalog_match(combo)
            if ctx_prod is not None:
                seen.add(combo)
                result.matched.append(_mk(ctx_prod, line, _parse_qty(line)))
                continue

        norm_line = normalize(line)
        if not norm_line or norm_line in seen:
            continue
        seen.add(norm_line)
        qty = _parse_qty(line)
        if prod is not None:
            context = line                          # this product line heads following codes
            result.matched.append(_mk(prod, line, qty))
        elif keep_unmatched:
            if _is_noise(clean):
                continue
            result.matched.append(MatchedItem(
                catalog_id="", raw_name=line, standard_name=clean, category="A buscar",
                brands=[], default_brand="", quantity=qty, known=False))
        else:
            result.unmatched.append(line)
    return result
