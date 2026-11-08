from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.exceptions import DomainError
from app.core.security import require_actor
from .models import Competition, Community, CompetitionSubmission, CompetitionSubmissionRevision, now
from .schemas import CompetitionInput, CompetitionCreate, CompetitionUpdate


def get_competition(session: Session, competition_id: str, *, lock=False, public=True) -> Competition:
    query = select(Competition).where(Competition.id == competition_id)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    comp = session.scalar(query)
    if comp is None or comp.deleted or (public and not comp.published):
        raise DomainError('NOT_FOUND', 'Competition not found.', 404)
    return comp


def present(session: Session, comp: Competition) -> dict:
    community = session.scalar(select(Community).where(Community.competition_id == comp.id))
    return dict(id=comp.id, title=comp.title, description=comp.description, category=comp.category,
                registrationDeadline=comp.registration_deadline.isoformat() + 'Z',
                deadlineStatus='BeforeDeadline' if comp.registration_deadline > now() else 'AfterDeadline',
                eligibilityRules=comp.eligibility_rules, maxTeamSize=comp.max_team_size,
                officialSourceUrl=comp.official_source_url, coverImage=comp.cover_image,
                published=comp.published, communityId=community.id)


def create_record(session: Session, body: CompetitionInput, published=True) -> Competition:
    comp = Competition(**body.columns(), published=published)
    session.add(comp)
    session.flush()
    session.add(Community(competition_id=comp.id))
    session.flush()
    return comp


def listing(session: Session, q: str, offset: int, limit: int, token: str | None = None) -> list:
    with session.begin():
        query = select(Competition).where(Competition.deleted.is_(False))
        if token is None:
            query = query.where(Competition.published.is_(True))
        else:
            require_actor(session, token, 'Admin')
        if q:
            query = query.where(Competition.title.contains(q, autoescape=True))
        return [present(session, c) for c in session.scalars(
            query.order_by(Competition.created_at.desc(), Competition.id).offset(offset).limit(limit))]


def detail(session: Session, competition_id: str) -> dict:
    with session.begin():
        return present(session, get_competition(session, competition_id))


def create(session: Session, token: str, body: CompetitionCreate) -> dict:
    with session.begin():
        require_actor(session, token, 'Admin')
        return present(session, create_record(session, body, body.published))


def update(session: Session, token: str, competition_id: str, body: CompetitionUpdate) -> dict:
    with session.begin():
        require_actor(session, token, 'Admin')
        comp = get_competition(session, competition_id, lock=True, public=False)
        current = present(session, comp)
        fields = {name: current[name] for name in CompetitionInput.model_fields}
        fields.update(body.model_dump(exclude_unset=True, exclude={'published'}))
        data = CompetitionInput.model_validate(fields)
        # Lock competition before any team row. Capacity is the configured limit, not occupancy.
        from app.modules.teams.models import Team, Membership
        from sqlalchemy import func
        teams = session.scalars(select(Team).where(Team.competition_id == comp.id,
                                Team.lifecycle == 'Active').with_for_update()).all()
        for team in teams:
            count = session.scalar(select(func.count()).select_from(Membership).where(
                Membership.team_id == team.id, Membership.status == 'Active'))
            if data.maxTeamSize < max(team.capacity, count):
                raise DomainError('INVALID_TEAM_LIMIT', 'Maximum team size would invalidate an active team.')
        if data.registrationDeadline > comp.registration_deadline:
            from app.modules.teams.service import expire_competition
            expire_competition(session, comp)
        for key, value in data.columns().items():
            setattr(comp, key, value)
        if body.published is not None:
            comp.published = body.published
        session.flush()
        if comp.registration_deadline <= now():
            from app.modules.teams.service import expire_competition
            expire_competition(session, comp)
        return present(session, comp)


def delete(session: Session, token: str, competition_id: str) -> None:
    with session.begin():
        require_actor(session, token, 'Admin')
        comp = get_competition(session, competition_id, lock=True, public=False)
        from app.modules.teams.models import Team
        if session.scalar(select(Team.id).where(Team.competition_id == comp.id,
                                               Team.lifecycle == 'Active').limit(1)):
            raise DomainError('ACTIVE_TEAMS', 'A competition with active teams cannot be deleted.')
        comp.deleted, comp.published = True, False


def submission_view(session: Session, obj: CompetitionSubmission) -> dict:
    revision = session.get(CompetitionSubmissionRevision, obj.latest_revision_id)
    return dict(id=obj.id, competitionId=obj.competition_id, revisionId=revision.id,
                status=revision.status, content=revision.payload, deleted=obj.deleted)


def submit(session: Session, token: str, body: CompetitionInput, submission_id: str | None = None) -> dict:
    with session.begin():
        actor = require_actor(session, token, 'Student')
        if submission_id:
            obj = session.scalar(select(CompetitionSubmission).where(
                CompetitionSubmission.id == submission_id).with_for_update())
            if obj is None:
                raise DomainError('NOT_FOUND', 'Submission not found.', 404)
            if obj.author_id != actor.id:
                raise DomainError('FORBIDDEN', 'Only the author can edit this submission.', 403)
            if obj.deleted or obj.competition_id:
                raise DomainError('SUBMISSION_CLOSED', 'This submission cannot be revised.')
            old = session.get(CompetitionSubmissionRevision, obj.latest_revision_id)
            if old.status == 'Pending':
                old.status = 'Superseded'
        else:
            obj = CompetitionSubmission(author_id=actor.id)
            session.add(obj)
            session.flush()
        revision = CompetitionSubmissionRevision(submission_id=obj.id, payload=body.model_dump(mode='json'))
        session.add(revision)
        session.flush()
        obj.latest_revision_id = revision.id
        return submission_view(session, obj)


def my_submissions(session: Session, token: str, offset: int, limit: int) -> list:
    with session.begin():
        actor = require_actor(session, token, 'Student')
        return [submission_view(session, obj) for obj in session.scalars(select(CompetitionSubmission).where(
            CompetitionSubmission.author_id == actor.id).order_by(CompetitionSubmission.created_at.desc(),
            CompetitionSubmission.id).offset(offset).limit(limit))]


def delete_submission(session: Session, token: str, submission_id: str) -> None:
    with session.begin():
        actor = require_actor(session, token, 'Student')
        obj = session.scalar(select(CompetitionSubmission).where(
            CompetitionSubmission.id == submission_id).with_for_update())
        if not obj:
            raise DomainError('NOT_FOUND', 'Submission not found.', 404)
        if obj.author_id != actor.id:
            raise DomainError('FORBIDDEN', 'Only the author may withdraw a submission.', 403)
        if obj.competition_id:
            raise DomainError('SUBMISSION_CLOSED', 'Published competitions are maintained by administrators.')
        obj.deleted = True
