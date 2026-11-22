from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import bearer_token
from app.db.session import get_session
from app.modules.profiles import service
from app.modules.profiles.schemas import ProfileUpdate

router = APIRouter(prefix='/profiles', tags=['profiles'])


@router.get('/me')
def own_profile(token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.own_profile(session, token)


@router.put('/me')
def replace_profile(data: ProfileUpdate, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.save_profile(session, token, data)


@router.patch('/me')
def update_profile(data: ProfileUpdate, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.save_profile(session, token, data, partial=True)
