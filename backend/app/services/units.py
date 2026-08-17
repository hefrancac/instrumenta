"""Pack-size parsing and per-unit pricing.

A store listing may be a box, a kit, or a single unit — comparing "caixa com 24"
against an avulso by sticker price is misleading. We parse how many base units a
listing contains and expose a per-unit price so comparisons are fair, and so the
optimizer can buy whole packs (you can't buy 5 of a box of 24 — you buy one box).

Pure standard library; unit-tested.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Optional

# Words that mark a countable pack, and the unit tokens that count pieces.
_PACK_KW = r"(?:caixa|cx|kit|pacote|pct|pack|leva|display|blister|envelope)"
_COUNT_UNIT = (r"(?:un(?:idades?)?|und|unid|p[çc]s?|pe[çc]as?|folhas?|envelopes?|"
               r"comprimidos?|amp(?:olas?)?|seringas?|refil|refis?|tubos?|pares?|tubetes?)")

# Order matters — first match wins. All gated so "nº 5", "z350", "4-0", "37%"
# are never mistaken for a pack count.
_PATTERNS = [
    re.compile(rf"{_PACK_KW}\s*(?:com\s*)?(\d{{1,4}})\s*{_COUNT_UNIT}", re.I),  # "caixa com 24 unidades"
    re.compile(rf"(\d{{1,4}})\s*{_COUNT_UNIT}\b", re.I),                        # "24 folhas"
    re.compile(rf"(?:caixa|cx|kit|pacote|pct|leva|display)\s*(?:com\s*)?(\d{{1,4}})\b", re.I),  # "caixa com 24"
    re.compile(r"\bc/\s*(\d{1,4})\b", re.I),                                    # "c/ 24"
]
_SIZE = re.compile(r"(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b", re.I)


@dataclass(frozen=True)
class PackInfo:
    pack_qty: int                      # base units per listing (>= 1)
    unit_value: Optional[float] = None  # e.g. 4.0 for "4g"
    unit_label: Optional[str] = None    # e.g. "g"


def parse_pack(title: str) -> PackInfo:
    t = title or ""
    pack_qty = 1
    for pat in _PATTERNS:
        m = pat.search(t)
        if m:
            n = int(m.group(1))
            if 1 <= n <= 5000:
                pack_qty = n
                break
    size = _SIZE.search(t)
    if size:
        val = float(size.group(1).replace(",", "."))
        return PackInfo(pack_qty=pack_qty, unit_value=val, unit_label=size.group(2).lower())
    return PackInfo(pack_qty=pack_qty)


def packs_needed(quantity: int, pack_qty: int) -> int:
    """How many listings to buy to cover `quantity` base units."""
    pq = max(1, int(pack_qty or 1))
    return max(1, math.ceil(max(1, int(quantity)) / pq))


def unit_price(price: float, pack_qty: int) -> float:
    pq = max(1, int(pack_qty or 1))
    return round(price / pq, 2)
