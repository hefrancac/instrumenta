"""Read a list, poll scraping status, and edit reviewed items."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import ExtractedItem, Job, SupplyList, User
from app.schemas import ItemOut, ItemUpdate, JobStatus, ListDetail, ListSummary, ListUpdate

router = APIRouter(prefix="/lists", tags=["Lists"])


def _owned_list(db: Session, list_id: int, user: User) -> SupplyList:
    supply = db.get(SupplyList, list_id)
    if supply is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lista não encontrada.")
    if supply.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sem acesso a esta lista.")
    return supply


def _summary(supply: SupplyList) -> ListSummary:
    return ListSummary(id=supply.id, name=supply.name, status=supply.status, item_count=len(supply.items))


@router.get("", response_model=list[ListSummary])
def list_all(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Todas as listas do usuário logado (metadados) — o cliente usa para carregar a nuvem."""
    rows = (db.query(SupplyList).filter(SupplyList.user_id == user.id)
            .order_by(SupplyList.created_at.desc()).all())
    return [_summary(s) for s in rows]


@router.get("/{list_id}", response_model=ListDetail)
def get_list(list_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _owned_list(db, list_id, user)


@router.patch("/{list_id}", response_model=ListSummary)
def rename_list(list_id: int, payload: ListUpdate,
                db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    supply = _owned_list(db, list_id, user)
    supply.name = payload.name
    db.commit(); db.refresh(supply)
    return _summary(supply)


@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_list(list_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    supply = _owned_list(db, list_id, user)
    db.delete(supply); db.commit()


@router.get("/{list_id}/status", response_model=JobStatus)
def get_status(list_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _owned_list(db, list_id, user)
    job = db.query(Job).filter(Job.list_id == list_id).first()
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job não encontrado.")
    return JobStatus(list_id=list_id, status=job.status, total_items=job.total_items,
                     completed_items=job.completed_items, progress=job.progress)


@router.patch("/{list_id}/items/{item_id}", response_model=ItemOut)
def update_item(list_id: int, item_id: int, payload: ItemUpdate,
                db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _owned_list(db, list_id, user)
    item = db.get(ExtractedItem, item_id)
    if item is None or item.list_id != list_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item não encontrado.")
    if payload.brand is not None:
        item.brand = payload.brand
    if payload.owned is not None:
        item.owned = payload.owned
    if payload.quantity is not None:
        item.quantity = payload.quantity
    db.commit()
    db.refresh(item)
    return item
