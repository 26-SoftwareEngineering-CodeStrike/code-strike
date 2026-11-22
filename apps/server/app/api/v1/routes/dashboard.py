"""Existing admin client contract: four counts and published competitions, no private data."""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.core.security import bearer_token, require_actor
from app.db.session import get_session
from app.modules.competitions.models import Competition, CompetitionSubmissionRevision
from app.modules.competitions.service import present
from app.modules.content.models import PostRevision, CommentRevision
from app.modules.teams.models import Application, Team, RecruitmentRevision

router = APIRouter(tags=['administration'])


@router.get('/dashboard')
def dashboard(token: str = Depends(bearer_token), session: Session = Depends(get_session)) -> dict:
    with session.begin():
        require_actor(session, token, 'Admin')
        def count(cls, *conditions):
            return session.scalar(select(func.count()).select_from(cls).where(*conditions))
        return dict(competitionCount=count(Competition, Competition.deleted.is_(False)),
                    pendingApplicationCount=count(Application, Application.status == 'Pending'),
                    activeTeamCount=count(Team, Team.lifecycle == 'Active'),
                    moderationCount=sum(count(cls, cls.status == 'Pending') for cls in
                        (CompetitionSubmissionRevision, PostRevision, CommentRevision, RecruitmentRevision)),
                    competitions=[present(session, c) for c in session.scalars(select(Competition).where(
                        Competition.published.is_(True), Competition.deleted.is_(False)).order_by(Competition.id).limit(100))])
