"""Freight estimation by destination CEP and order weight.

Real Brazilian freight depends on where the student lives and how heavy the order
is — a flat per-store fee makes the optimizer recommend the wrong store for
someone in the North. We map the CEP to a macro-region multiplier and combine a
per-store base + per-kg rate with the order weight. Free-shipping thresholds
still apply on subtotal and waive freight entirely.

Pure standard library; unit-tested.
"""
from __future__ import annotations

import re

# CEP first digit -> macro-region (Correios numbering).
_CEP_REGION = {
    "0": "SP", "1": "SP",           # Grande SP / interior SP
    "2": "SE", "3": "SE",           # RJ/ES / MG
    "4": "NE", "5": "NE",           # BA/SE / PE/AL/PB/RN
    "6": "N",                        # CE/PI/MA + Norte
    "7": "CO",                       # DF/GO/TO/MT/MS + parte Norte
    "8": "S", "9": "S",             # PR/SC / RS
}

# Relative shipping cost from a Sudeste-centric logistics baseline.
_REGION_MULT = {"SP": 1.00, "SE": 1.10, "S": 1.15, "CO": 1.35, "NE": 1.45, "N": 1.75}

DEFAULT_REGION = "SP"


def region_from_cep(cep: str | None) -> str:
    digits = re.sub(r"\D", "", cep or "")
    return _CEP_REGION.get(digits[0], DEFAULT_REGION) if digits else DEFAULT_REGION


def region_multiplier(cep: str | None) -> float:
    return _REGION_MULT[region_from_cep(cep)]


def estimate_freight(base: float, per_kg: float, weight_g: float, multiplier: float = 1.0) -> float:
    weight_kg = max(0.0, weight_g) / 1000.0
    return round((base + per_kg * weight_kg) * multiplier, 2)
