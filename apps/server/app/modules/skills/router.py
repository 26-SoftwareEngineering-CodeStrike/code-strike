from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import bearer_token
from app.db.session import get_session
from app.modules.skills import service
from app.modules.skills.schemas import SkillWrite

router = APIRouter(prefix='/skills', tags=['skills'])


@router.get('')
def list_skills(session: Session = Depends(get_session)):
    return service.list_skills(session)


@router.post('', status_code=201)
def create_skill(data: SkillWrite, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.save_skill(session, token, data)


@router.patch('/{skill_id}')
def rename_skill(skill_id: str, data: SkillWrite, token: str = Depends(bearer_token),
                 session: Session = Depends(get_session)):
    return service.save_skill(session, token, data, skill_id)
