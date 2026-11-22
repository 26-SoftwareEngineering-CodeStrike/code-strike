from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import DomainError
from app.core.security import require_actor
from app.modules.skills.models import Skill


def list_skills(session: Session) -> list[dict]:
    with session.begin():
        return [{'id': skill.id, 'name': skill.name}
                for skill in session.scalars(select(Skill).order_by(Skill.name))]


def save_skill(session: Session, token: str, data, skill_id: str | None = None) -> dict:
    with session.begin():
        require_actor(session, token, 'Admin')
        skill = session.scalar(select(Skill).where(Skill.id == skill_id).with_for_update()) if skill_id else None
        if skill_id and skill is None:
            raise DomainError('NOT_FOUND', 'Skill not found.', 404)
        duplicate = session.scalar(select(Skill.id).where(func.lower(Skill.name) == data.name.lower()))
        if duplicate and duplicate != skill_id:
            raise DomainError('SKILL_EXISTS', 'Skill name already exists.')
        if skill is None:
            skill = Skill(name=data.name)
            session.add(skill)
        else:
            skill.name = data.name
        session.flush()
        return {'id': skill.id, 'name': skill.name}
