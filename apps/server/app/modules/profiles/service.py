from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.exceptions import DomainError
from app.core.security import require_actor
from app.modules.auth.models import User
from app.modules.profiles.models import Profile, ProfileSkill
from app.modules.skills.models import Skill

_FIELDS = {'name': 'name', 'college': 'college', 'major': 'major', 'academic_year': 'academicYear',
           'sex': 'sex', 'brief_cv': 'briefCv', 'wechat_id': 'wechatId', 'qq_id': 'qqId',
           'mbti': 'mbti', 'hobbies': 'hobbies'}


def get_skill_ids(session: Session, user_id: str) -> set[str]:
    return set(session.scalars(select(ProfileSkill.skill_id).where(ProfileSkill.user_id == user_id)))


def _skills(session: Session, user_id: str) -> list[dict]:
    rows = session.scalars(select(Skill).join(ProfileSkill, ProfileSkill.skill_id == Skill.id)
                          .where(ProfileSkill.user_id == user_id).order_by(Skill.name))
    return [dict(id=row.id, name=row.name) for row in rows]


def missing_fields(session: Session, user_id: str) -> list[str]:
    profile = session.get(Profile, user_id)
    fields = ['name', 'college', 'major', 'academic_year', 'sex', 'brief_cv']
    missing = [_FIELDS[field] for field in fields
               if not profile or not (getattr(profile, field) or '').strip()]
    if not get_skill_ids(session, user_id):
        missing.append('skills')
    if not profile or not ((profile.wechat_id or '').strip() or (profile.qq_id or '').strip()):
        missing.append('contact')
    return missing


def require_complete_profile(session: Session, user_id: str) -> None:
    """Transaction-neutral gate for posting/admission; do not apply to planner access."""
    missing = missing_fields(session, user_id)
    if missing:
        raise DomainError('PROFILE_INCOMPLETE', 'Complete your profile before this operation.', 422,
                          {'missingFields': missing})


def profile_preview(session: Session, user_id: str) -> dict:
    """Caller must check current application/captain privileges before requesting this projection."""
    profile = session.get(Profile, user_id)
    return {'name': profile.name if profile else None,
            'college': profile.college if profile else None,
            'sex': profile.sex if profile else None,
            'skills': _skills(session, user_id),
            'briefCv': profile.brief_cv if profile else None}


def _payload(session: Session, user_id: str) -> dict:
    profile = session.get(Profile, user_id)
    result = {alias: getattr(profile, field) if profile else None for field, alias in _FIELDS.items()}
    result.update(userId=user_id, skills=_skills(session, user_id),
                  skillIds=sorted(get_skill_ids(session, user_id)), missingFields=missing_fields(session, user_id))
    result['complete'] = not result['missingFields']
    return result


def own_profile(session: Session, token: str) -> dict:
    with session.begin():
        user = require_actor(session, token, 'Student')
        return _payload(session, user.id)


def save_profile(session: Session, token: str, data, *, partial: bool = False) -> dict:
    with session.begin():
        user = require_actor(session, token, 'Student')
        session.scalar(select(User).where(User.id == user.id).with_for_update())
        require_actor(session, token, 'Student')
        profile = session.get(Profile, user.id)
        if profile is None:
            profile = Profile(user_id=user.id)
            session.add(profile)
        values = data.model_dump(exclude_unset=partial)
        skill_ids = values.pop('skill_ids', None)
        if skill_ids is not None:
            known = set(session.scalars(select(Skill.id).where(Skill.id.in_(skill_ids))))
            if known != set(skill_ids):
                raise DomainError('INVALID_SKILLS', 'Select skills from the predefined catalog.', 422)
            session.flush()
            session.execute(delete(ProfileSkill).where(ProfileSkill.user_id == user.id))
            session.add_all(ProfileSkill(user_id=user.id, skill_id=key) for key in skill_ids)
        for field, value in values.items():
            setattr(profile, field, value)
        session.flush()
        return _payload(session, user.id)
