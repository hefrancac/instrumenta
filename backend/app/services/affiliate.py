"""Build tracked outbound (affiliate) URLs for a store offer."""
from __future__ import annotations

from urllib.parse import quote


def build_affiliate_url(store, offer_url: str | None) -> str:
    """Return a monetizable, trackable URL for `offer_url` at `store`.

    Priority: an explicit per-store template ({url}/{tag} placeholders), then a
    generic affiliate/utm tag appended to the product URL, else the raw URL.
    """
    base = offer_url or getattr(store, "base_url", "") or ""
    template = getattr(store, "affiliate_template", None)
    tag = getattr(store, "affiliate_tag", None)
    if template:
        return template.replace("{url}", quote(base, safe="")).replace("{tag}", tag or "")
    if tag and base:
        sep = "&" if "?" in base else "?"
        return f"{base}{sep}utm_source=instrumenta&utm_medium=affiliate&aff={tag}"
    return base
