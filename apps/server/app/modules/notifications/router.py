from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from app.core.security import bearer_token
from app.db.session import get_session
from . import service

router = APIRouter(prefix="/notifications", tags=["notifications"])


class ReadState(BaseModel):
    model_config = ConfigDict(extra="forbid")
    isRead: bool = True


@router.get("")
def inbox(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
          token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.inbox(session, token, offset, limit)


@router.get("/{notification_id}")
def detail(notification_id: str, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.detail(session, token, notification_id)


@router.patch("/{notification_id}")
def mark(notification_id: str, body: ReadState, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.detail(session, token, notification_id, body.isRead)
