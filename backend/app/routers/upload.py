"""Ingest a supply list (file upload or raw text) and kick off scraping."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.database import get_db
from app.models import ExtractedItem, Job, SupplyList, User
from app.schemas import TextUploadRequest, UploadResponse
from app.services import ai_service

log = logging.getLogger("upload")
router = APIRouter(prefix="/lists", tags=["Lists"])

_ALLOWED_MIME = ("text/", "image/", "application/pdf")


def _persist_and_dispatch(db: Session, user: User, matched) -> SupplyList:
    if not matched:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "Nenhum item reconhecido na lista.")
    supply = SupplyList(user_id=user.id, status="processing")
    db.add(supply)
    db.flush()  # get supply.id without a second round-trip

    for m in matched:
        db.add(ExtractedItem(list_id=supply.id, raw_name=m.raw_name,
                             standard_name=m.standard_name, category=m.category,
                             brand=m.default_brand or None, quantity=getattr(m, "quantity", 1),
                             owned=False))

    names = sorted({m.standard_name for m in matched})
    db.add(Job(list_id=supply.id, status="pending", total_items=len(names)))
    db.commit()
    db.refresh(supply)

    # Fire-and-forget scraping. Imported here to avoid a hard dependency on the
    # broker when the API is imported for tests.
    try:
        from worker.tasks import process_list
        process_list.delay(supply.id)
    except Exception as exc:  # noqa: BLE001
        log.warning("Could not enqueue scraping (broker down?)", exc_info=exc)
    return supply


@router.post("/upload", response_model=UploadResponse, status_code=201)
async def upload_list(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    mime = file.content_type or ""
    if not mime.startswith(_ALLOWED_MIME):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                            f"Tipo não suportado: {mime}. Envie texto, imagem ou PDF.")
    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            f"Arquivo excede {settings.MAX_UPLOAD_MB} MB.")
    try:
        if mime.startswith("text/"):
            matched = ai_service.extract_items(text=content.decode("utf-8", errors="ignore"))
        else:
            matched = ai_service.extract_items(file_bytes=content, mime=mime)
    except ai_service.UnprocessableInput as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))

    supply = _persist_and_dispatch(db, user, matched)
    return UploadResponse(list_id=supply.id, status=supply.status,
                          item_count=len(supply.items), items=supply.items)


@router.post("/text", response_model=UploadResponse, status_code=201)
def upload_text(
    payload: TextUploadRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Convenience endpoint for the paste-a-list flow (no file needed)."""
    matched = ai_service.extract_items(text=payload.text)
    supply = _persist_and_dispatch(db, user, matched)
    return UploadResponse(list_id=supply.id, status=supply.status,
                          item_count=len(supply.items), items=supply.items)
