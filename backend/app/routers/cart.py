"""Optimized cart endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import SupplyList, User
from app.schemas import OptimizeResponse
from app.services.pricing import optimize_list

router = APIRouter(prefix="/cart", tags=["Cart"])


@router.get("/optimize/{list_id}", response_model=OptimizeResponse)
def get_optimized_cart(list_id: int,
                       cep: str | None = Query(default=None, description="CEP de destino p/ frete"),
                       db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    supply = db.get(SupplyList, list_id)
    if supply is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lista não encontrada.")
    if supply.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sem acesso a esta lista.")
    if cep:                       # remember it so a shared link inherits the destination
        supply.cep = cep
        db.commit()
    return optimize_list(db, list_id, cep)
