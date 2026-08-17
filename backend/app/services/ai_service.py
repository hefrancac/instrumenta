"""Name-standardization service.

Design: the canonical taxonomy (catalog.py) is always the source of truth. The
LLM's job is to *read* messy input (handwriting, abbreviations, PDF layout) and
emit clean one-item-per-line text; the deterministic matcher then maps that text
onto canonical entries. This keeps the DB consistent while letting the LLM boost
recall on inputs the pure matcher would miss.

Fallbacks, in order:
  1. If an Anthropic key is set -> vision/text extraction via the SDK.
  2. Else, for text input -> the local keyword matcher directly.
  3. Else, for images/PDF without a key -> a clear 422 (no offline OCR assumed).
"""
from __future__ import annotations

import base64
import json
import logging

from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.services import matcher
from app.services.catalog import CATALOG

log = logging.getLogger("ai_service")


class UnprocessableInput(Exception):
    """Raised when we cannot extract items from the given input."""


def _canonical_names_prompt() -> str:
    names = "\n".join(f"- {p.standard_name}" for p in CATALOG)
    return (
        "Você é um assistente que lê listas de materiais de odontologia. "
        "Extraia CADA item da lista, um por linha, corrigindo abreviações e erros "
        "(ex.: 'sonda n5' -> 'sonda exploradora nº 5'). Responda APENAS com JSON no "
        'formato {"items": ["item 1", "item 2", ...]} sem texto extra.\n\n'
        "Itens comuns de referência (use como guia de nomenclatura):\n" + names
    )


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8), reraise=True)
def _call_anthropic(content_blocks: list[dict]) -> list[str]:
    import anthropic  # imported lazily so the app runs without the dep in mock mode

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    resp = client.messages.create(
        model=settings.LLM_MODEL,
        max_tokens=settings.LLM_MAX_TOKENS,
        system=_canonical_names_prompt(),
        messages=[{"role": "user", "content": content_blocks}],
    )
    text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
    text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    data = json.loads(text)
    items = data.get("items", [])
    return [str(i) for i in items if str(i).strip()]


def _extract_lines(text: str | None, file_bytes: bytes | None, mime: str | None) -> list[str]:
    """Return cleaned, one-item-per-line strings from any supported input."""
    has_key = bool(settings.ANTHROPIC_API_KEY)

    if has_key:
        blocks: list[dict] = []
        if file_bytes and mime and mime.startswith("image/"):
            blocks.append({"type": "image", "source": {
                "type": "base64", "media_type": mime,
                "data": base64.b64encode(file_bytes).decode()}})
            blocks.append({"type": "text", "text": "Extraia os itens desta foto da lista."})
        elif file_bytes and mime == "application/pdf":
            blocks.append({"type": "document", "source": {
                "type": "base64", "media_type": "application/pdf",
                "data": base64.b64encode(file_bytes).decode()}})
            blocks.append({"type": "text", "text": "Extraia os itens deste PDF."})
        elif text:
            blocks.append({"type": "text", "text": f"Extraia os itens desta lista:\n\n{text}"})
        else:
            raise UnprocessableInput("Entrada vazia.")
        try:
            return _call_anthropic(blocks)
        except Exception as exc:  # noqa: BLE001 - fall back gracefully
            log.warning("LLM extraction failed, falling back to local matcher", exc_info=exc)

    # -- Fallback paths (no key, or LLM failed) --
    if text:
        return [ln.strip() for ln in text.replace(",", "\n").splitlines() if ln.strip()]
    raise UnprocessableInput(
        "Não foi possível ler o arquivo sem um modelo de visão configurado. "
        "Configure ANTHROPIC_API_KEY ou envie a lista como texto."
    )


def extract_items(text: str | None = None, file_bytes: bytes | None = None,
                  mime: str | None = None) -> list[matcher.MatchedItem]:
    """Full pipeline: read input -> canonical matched items."""
    lines = _extract_lines(text, file_bytes, mime)
    result = matcher.match_list("\n".join(lines), keep_unmatched=True)
    if result.unmatched:
        log.info("Unmatched lines", extra={"extra_fields": {"unmatched": result.unmatched}})
    return result.matched
