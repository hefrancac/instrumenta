"""Reusable FastAPI dependencies (auth, current user)."""
from __future__ import annotations

import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_access_token, hash_password
from app.database import get_db
from app.models import User

# auto_error=False so we can implement the demo-mode fallback ourselves.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_PREFIX}/auth/login", auto_error=False)


def _get_or_create_demo_user(db: Session) -> User:
    user = db.query(User).filter(User.email == settings.DEMO_USER_EMAIL).first()
    if user is None:
        user = User(email=settings.DEMO_USER_EMAIL, hashed_password=hash_password("demo-not-a-password"))
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_current_user(token: str | None = Depends(oauth2_scheme),
                     db: Session = Depends(get_db)) -> User:
    """Resolve the authenticated user.

    In DEMO_MODE, a missing token yields a shared demo account so the frontend
    can operate without a login screen. A *malformed* token is always rejected.
    """
    if token is None:
        if settings.DEMO_MODE:
            return _get_or_create_demo_user(db)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated",
                            headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token",
                            headers={"WWW-Authenticate": "Bearer"})
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    return user


def require_admin(x_admin_token: str | None = Header(default=None)) -> None:
    """Gate internal admin endpoints.

    In DEMO_MODE this is open (single-operator dev). In production it requires an
    `X-Admin-Token` header matching ADMIN_API_TOKEN; if no token is configured,
    access is denied by default (fail closed).
    """
    if settings.DEMO_MODE:
        return
    if not settings.ADMIN_API_TOKEN or x_admin_token != settings.ADMIN_API_TOKEN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required.")
