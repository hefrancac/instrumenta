"""Authentication endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models import User
from app.schemas import Token, UserCreate, UserOut

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserOut, status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "E-mail já cadastrado.")
    user = User(email=payload.email, hashed_password=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _issue_token(form: OAuth2PasswordRequestForm, db: Session) -> Token:
    # OAuth2 form uses `username`; we treat it as the email.
    user = db.query(User).filter(User.email == form.username).first()
    if user is None or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenciais inválidas.",
                            headers={"WWW-Authenticate": "Bearer"})
    return Token(access_token=create_access_token(subject=str(user.id)))


@router.post("/token", response_model=Token)
def token(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Endpoint OAuth2 padrão (usado pelo frontend e pelo Swagger 'Authorize')."""
    return _issue_token(form, db)


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Alias de /token (compatibilidade)."""
    return _issue_token(form, db)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    """Dados do usuário autenticado — o frontend usa para restaurar a sessão do token."""
    return user
