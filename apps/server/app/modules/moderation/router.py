from typing import Literal
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.security import bearer_token
from app.db.session import get_session
from . import service
from .schemas import Decision

router = APIRouter(prefix='/moderation', tags=['moderation'])


@router.get('')
def queue(offset: int = Query(0, ge=0, le=100000), limit: int = Query(50, ge=1, le=100),
          status: Literal['Pending', 'Approved', 'Rejected', 'Superseded'] = 'Pending',
          token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.listing(session, token, offset, limit, status)


@router.get('/{revision_id}')
def detail(revision_id: str, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.detail(session, token, revision_id)


@router.post('/{revision_id}')
def decide(revision_id: str, body: Decision, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.decide(session, token, revision_id, body)
