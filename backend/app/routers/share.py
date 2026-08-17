"""Public, read-only sharing of an optimized list.

POST /lists/{id}/share  -> mints a share token (owner only).
GET  /share/{token}     -> the optimized cart, no auth (for sharing with friends).
"""
from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import SupplyList, User
from app.schemas import OptimizeResponse, ShareResponse
from app.services.pricing import optimize_list

router = APIRouter(tags=["Share"])


@router.post("/lists/{list_id}/share", response_model=ShareResponse)
def create_share(list_id: int, request: Request, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    supply = db.get(SupplyList, list_id)
    if supply is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lista não encontrada.")
    if supply.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sem acesso a esta lista.")
    if not supply.share_token:
        supply.share_token = secrets.token_urlsafe(16)
    supply.is_public = True
    db.commit()
    base = str(request.base_url).rstrip("/")
    return ShareResponse(token=supply.share_token,
                         share_url=f"{base}/share/{supply.share_token}")


@router.get("/share/{token}", response_model=OptimizeResponse)
def read_share(token: str, db: Session = Depends(get_db)):
    supply = (db.query(SupplyList)
              .filter(SupplyList.share_token == token, SupplyList.is_public.is_(True))
              .first())
    if supply is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Link inválido ou expirado.")
    return optimize_list(db, supply.id)
