"""Competition-row serialization makes every admission/membership change atomic.

Lock order: competition -> team -> application/membership. Authentication is read inside
the service transaction; dependencies never start an implicit transaction first.
"""
from collections.abc import Callable
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.exceptions import DomainError
from app.core.security import require_actor
from app.modules.auth.models import User
from app.modules.competitions.models import Competition
from app.modules.notifications.service import notify
from app.modules.profiles.service import get_skill_ids, profile_preview, require_complete_profile
from app.modules.skills.models import Skill
from .models import Application, Membership, RecruitmentRevision, Team, TeamSkill, now
from .schemas import TeamCreate, TeamFields


def count_members(session: Session, team_id: str) -> int:
    session.flush()
    return session.scalar(select(func.count()).select_from(Membership).where(
        Membership.team_id == team_id, Membership.status == "Active")) or 0


def current_membership(session: Session, student_id: str, competition_id: str):
    return session.scalar(select(Membership).where(Membership.student_id == student_id,
        Membership.competition_id == competition_id, Membership.status == "Active"))


def invalidate(session: Session, query, reason: str) -> None:
    for a in session.scalars(query.where(Application.status == "Pending").with_for_update()):
        a.status, a.reason, a.decided_at = "Invalidated", reason, now()
        notify(session, a.applicant_id, "ApplicationInvalidated", "application", a.id, reason)
        team = session.get(Team, a.team_id)
        notify(session, team.captain_id, "ApplicationInvalidated", "application", a.id, reason)
    session.flush()


def expire_competition(session: Session, competition: Competition) -> bool:
    """Caller holds the competition lock; also called before extending its deadline."""
    if competition.registration_deadline > now():
        return False
    invalidate(session, select(Application).where(Application.competition_id == competition.id),
               "Competition registration deadline has passed.")
    for team in session.scalars(select(Team).where(Team.competition_id == competition.id,
                                                  Team.lifecycle == "Active").with_for_update()):
        team.recruitment_switch = "Closed"
    session.flush()
    return True


def close_full_team(session: Session, team: Team) -> None:
    if count_members(session, team.id) >= team.capacity:
        team.recruitment_switch = "Closed"
        invalidate(session, select(Application).where(Application.team_id == team.id), "This team is full.")


def require_captain(team: Team, user: User) -> None:
    if team.lifecycle != "Active" or team.captain_id != user.id:
        raise DomainError("FORBIDDEN", "Only the current captain of an active team may perform this action.", 403)


def require_active(team: Team) -> None:
    if team.lifecycle != "Active":
        raise DomainError("TEAM_DISSOLVED", "This team has been dissolved.")


def require_space(session: Session, team: Team) -> None:
    if count_members(session, team.id) >= team.capacity:
        raise DomainError("TEAM_FULL", "This team is full.")


def validate_fields(session: Session, data: TeamFields, competition: Competition, minimum: int = 1):
    if not minimum <= data.capacity <= competition.max_team_size:
        raise DomainError("INVALID_CAPACITY", "Capacity must include current members and not exceed the competition limit.", 422)
    skill_ids = set(data.skill_ids)
    if len(session.scalars(select(Skill.id).where(Skill.id.in_(skill_ids))).all()) != len(skill_ids):
        raise DomainError("INVALID_SKILLS", "Choose skills from the predefined catalog.", 422)


def replace_skills(session: Session, team: Team, ids: list[str]):
    session.execute(delete(TeamSkill).where(TeamSkill.team_id == team.id))
    for skill_id in set(ids):
        session.add(TeamSkill(team_id=team.id, skill_id=skill_id))
    session.flush()


def team_skills(session: Session, team_id: str) -> list[dict]:
    return [{"id": x.id, "name": x.name} for x in session.scalars(
        select(Skill).join(TeamSkill, TeamSkill.skill_id == Skill.id).where(TeamSkill.team_id == team_id).order_by(Skill.name))]


def team_view(session: Session, team: Team) -> dict:
    captain = session.get(User, team.captain_id)
    return {"id": team.id, "competitionId": team.competition_id, "name": team.name,
            "summary": team.summary, "memberCount": count_members(session, team.id),
            "capacity": team.capacity, "lifecycle": team.lifecycle, "publication": team.publication,
            "recruitmentSwitch": team.recruitment_switch, "skills": team_skills(session, team.id),
            "captainUsername": captain.username}


def application_view(session: Session, a: Application) -> dict:
    return {"id": a.id, "competitionId": a.competition_id, "teamId": a.team_id,
            "teamName": session.get(Team, a.team_id).name, "status": a.status,
            "reason": a.reason, "createdAt": a.created_at, "decidedAt": a.decided_at}


def _run(session: Session, token: str, operation: Callable, *, competition_id: str | None = None,
         team_id: str | None = None, application_id: str | None = None,
         revision_id: str | None = None, deadline_guard: bool = False, role: str = "Student"):
    error = None
    result = None
    with session.begin():
        actor = require_actor(session, token, role=role)
        if application_id:
            a = session.get(Application, application_id)
            if not a:
                raise DomainError("NOT_FOUND", "Application not found.", 404)
            team_id = a.team_id
        if revision_id:
            revision = session.get(RecruitmentRevision, revision_id)
            if not revision:
                raise DomainError("NOT_FOUND", "Revision not found.", 404)
            team_id = revision.team_id
        if team_id:
            team = session.get(Team, team_id)
            if not team:
                raise DomainError("NOT_FOUND", "Team not found.", 404)
            competition_id = team.competition_id
        competition = session.scalar(select(Competition).where(Competition.id == competition_id)
                                     .with_for_update().execution_options(populate_existing=True))
        if not competition or competition.deleted or (deadline_guard and not competition.published):
            raise DomainError("NOT_FOUND", "Competition not found.", 404)
        expired = expire_competition(session, competition)
        team = session.scalar(select(Team).where(Team.id == team_id).with_for_update()
                              .execution_options(populate_existing=True)) if team_id else None
        if expired and deadline_guard:
            # Commit deadline cleanup even though admission itself is rejected.
            error = DomainError("DEADLINE_PASSED", "Competition registration deadline has passed.")
        else:
            result = operation(actor, competition, team)
    if error:
        raise error
    return result


def _submit_revision(session: Session, actor: User, competition: Competition, team: Team,
                     data: TeamFields):
    require_captain(team, actor)
    if team.recruitment_removed:
        raise DomainError("REMOVED", "Removed recruitment cannot be republished.")
    validate_fields(session, data, competition, count_members(session, team.id))
    if team.latest_revision_id:
        old = session.get(RecruitmentRevision, team.latest_revision_id)
        if old and old.status == "Pending":
            old.status = "Superseded"
    revision = RecruitmentRevision(team_id=team.id, author_id=actor.id,
                                   payload=data.model_dump(by_alias=True), status="Pending")
    session.add(revision)
    session.flush()
    team.latest_revision_id = revision.id
    team.publication = "Delisted" if team.approved_revision_id else "Pending"
    return {"id": revision.id, "teamId": team.id, "status": revision.status,
            "publication": team.publication, "proposed": revision.payload}


def create_team(session: Session, token: str, data: TeamCreate):
    def operation(actor, competition, _):
        require_complete_profile(session, actor.id)
        validate_fields(session, data, competition)
        if current_membership(session, actor.id, competition.id):
            raise DomainError("ALREADY_MEMBER", "You already belong to a team in this competition.")
        team = Team(competition_id=competition.id, captain_id=actor.id, name=data.name,
                    summary=data.summary, capacity=data.capacity)
        session.add(team)
        session.flush()
        session.add(Membership(student_id=actor.id, competition_id=competition.id, team_id=team.id))
        replace_skills(session, team, data.skill_ids)
        invalidate(session, select(Application).where(Application.applicant_id == actor.id,
                   Application.competition_id == competition.id), "Created a team in this competition.")
        close_full_team(session, team)
        result = team_view(session, team)
        if data.submit_recruitment:
            fields = TeamFields.model_validate(data.model_dump(include={"name", "summary", "capacity", "skill_ids"}))
            result["revision"] = _submit_revision(session, actor, competition, team, fields)
            result["publication"] = team.publication
        return result
    return _run(session, token, operation, competition_id=data.competition_id, deadline_guard=True)


def submit_revision(session: Session, token: str, team_id: str, data: TeamFields):
    return _run(session, token, lambda actor, comp, team: _submit_revision(session, actor, comp, team, data), team_id=team_id)


def switch(session: Session, token: str, team_id: str, state: str):
    def operation(actor, competition, team):
        require_captain(team, actor)
        if state == "Open":
            if competition.registration_deadline <= now():
                raise DomainError("DEADLINE_PASSED", "Competition registration deadline has passed.")
            require_space(session, team)
        team.recruitment_switch = state
        return team_view(session, team)
    return _run(session, token, operation, team_id=team_id)


def apply(session: Session, token: str, team_id: str):
    def operation(actor, competition, team):
        require_complete_profile(session, actor.id)
        require_active(team)
        require_space(session, team)
        if team.publication != "Published" or team.recruitment_switch != "Open":
            raise DomainError("RECRUITMENT_CLOSED", "Recruitment is not published and open.")
        if current_membership(session, actor.id, competition.id):
            raise DomainError("ALREADY_MEMBER", "You already belong to a team in this competition.")
        if session.scalar(select(Application.id).where(Application.team_id == team.id,
                          Application.applicant_id == actor.id, Application.status == "Pending")):
            raise DomainError("DUPLICATE_PENDING", "A Pending application already exists for this team.")
        a = Application(applicant_id=actor.id, team_id=team.id, competition_id=competition.id)
        session.add(a)
        session.flush()
        notify(session, team.captain_id, "NewApplication", "application", a.id, "A new application awaits review.")
        return application_view(session, a)
    return _run(session, token, operation, team_id=team_id, deadline_guard=True)


def application_action(session: Session, token: str, application_id: str, action: str, reason: str = ""):
    def operation(actor, competition, team):
        a = session.scalar(select(Application).where(Application.id == application_id).with_for_update()
                           .execution_options(populate_existing=True))
        if action == "Withdrawn":
            if a.applicant_id != actor.id:
                raise DomainError("FORBIDDEN", "Only the applicant may withdraw.", 403)
        else:
            require_captain(team, actor)
        if action == "Approved":
            require_space(session, team)
        if a.status != "Pending":
            raise DomainError("APPLICATION_PROCESSED", "This application is no longer Pending.")
        if action == "Approved":
            require_complete_profile(session, a.applicant_id)
            if current_membership(session, a.applicant_id, competition.id):
                raise DomainError("ALREADY_MEMBER", "Applicant already belongs to a team in this competition.")
            session.add(Membership(student_id=a.applicant_id, competition_id=competition.id, team_id=team.id))
        a.status, a.reason, a.decided_at = action, reason or None, now()
        session.flush()
        notify(session, a.applicant_id, "Application" + action, "application", a.id, "Application " + action.lower() + ".")
        if action == "Withdrawn":
            notify(session, team.captain_id, "ApplicationWithdrawn", "application", a.id, "An application was withdrawn.")
        if action == "Approved":
            invalidate(session, select(Application).where(Application.applicant_id == a.applicant_id,
                       Application.competition_id == competition.id), "Joined a team in this competition.")
            for m in session.scalars(select(Membership).where(Membership.team_id == team.id, Membership.status == "Active")):
                notify(session, m.student_id, "MemberJoined", "team", team.id, "A member joined your team.")
            close_full_team(session, team)
        return application_view(session, a)
    return _run(session, token, operation, application_id=application_id, deadline_guard=action == "Approved")


def members(session: Session, token: str, team_id: str, contact_id: str | None = None):
    def operation(actor, competition, team):
        own = current_membership(session, actor.id, competition.id)
        if team.lifecycle != "Active" or not own or own.team_id != team.id:
            raise DomainError("FORBIDDEN", "Current team membership is required.", 403)
        if contact_id:
            require_captain(team, actor)
            member = current_membership(session, contact_id, competition.id)
            if not member or member.team_id != team.id:
                raise DomainError("FORBIDDEN", "Contact access requires current membership.", 403)
            from app.modules.profiles.models import Profile
            p = session.get(Profile, contact_id)
            return {"userId": contact_id, "wechatId": p.wechat_id if p else None, "qqId": p.qq_id if p else None}
        rows = session.execute(select(Membership, User).join(User, User.id == Membership.student_id)
            .where(Membership.team_id == team.id, Membership.status == "Active"))
        return [{"id": m.id, "userId": u.id, "teamId": team.id, "username": u.username,
                 "status": "Active", "role": "Captain" if u.id == team.captain_id else "Member"} for m, u in rows]
    return _run(session, token, operation, team_id=team_id)


def member_action(session: Session, token: str, team_id: str, action: str, member_id: str | None = None):
    def operation(actor, competition, team):
        require_active(team)
        if action != "leave":
            require_captain(team, actor)
        target = actor.id if action == "leave" else member_id
        if action == "dissolve":
            affected = session.scalars(select(Membership).where(Membership.team_id == team.id, Membership.status == "Active")).all()
            team.lifecycle, team.publication, team.recruitment_switch = "Dissolved", "Delisted", "Closed"
            invalidate(session, select(Application).where(Application.team_id == team.id), "Team dissolved.")
            if team.latest_revision_id:
                rev = session.get(RecruitmentRevision, team.latest_revision_id)
                if rev.status == "Pending":
                    rev.status = "Superseded"
            for m in affected:
                m.status, m.ended_at, m.end_reason = "Ended", now(), "Team dissolved."
                notify(session, m.student_id, "TeamDissolved", "team", team.id, "Your team was dissolved.")
        else:
            member = current_membership(session, target, competition.id)
            if not member or member.team_id != team.id:
                raise DomainError("NOT_MEMBER", "Target must be a current member of this team.")
            if action == "transfer":
                if target == team.captain_id:
                    raise DomainError("ALREADY_CAPTAIN", "This member is already captain.")
                team.captain_id = target
                for m in session.scalars(select(Membership).where(Membership.team_id == team.id, Membership.status == "Active")):
                    notify(session, m.student_id, "CaptainTransferred", "team", team.id, "Team captaincy was transferred.")
            else:
                if target == team.captain_id:
                    raise DomainError("CAPTAIN_CANNOT_LEAVE", "Transfer captaincy or dissolve the team before leaving.")
                member.status, member.ended_at, member.end_reason = "Ended", now(), "Left team." if action == "leave" else "Removed by captain."
                notify(session, target, "MemberDeparted" if action == "leave" else "MemberRemoved", "team", team.id, member.end_reason)
                notify(session, team.captain_id, "MemberDeparted", "team", team.id, "A member left the team.")
        return {"status": "ok"}
    return _run(session, token, operation, team_id=team_id)


def applicant_profile(session: Session, token: str, application_id: str):
    def operation(actor, competition, team):
        require_captain(team, actor)
        a = session.get(Application, application_id, populate_existing=True)
        if a.status != "Pending" or competition.registration_deadline <= now():
            raise DomainError("FORBIDDEN", "This application no longer grants profile access.", 403)
        return profile_preview(session, a.applicant_id)
    return _run(session, token, operation, application_id=application_id)


def review_queue(session: Session, token: str, team_id: str, offset: int, limit: int):
    def operation(actor, competition, team):
        require_captain(team, actor)
        skills = {s["id"] for s in team_skills(session, team.id)}
        result = []
        for a in session.scalars(select(Application).where(Application.team_id == team.id, Application.status == "Pending")
                                  .order_by(Application.created_at, Application.id).offset(offset).limit(limit)):
            match = bool(skills & get_skill_ids(session, a.applicant_id))
            result.append({**application_view(session, a), "applicant": profile_preview(session, a.applicant_id),
                           "match": "Matched" if match else "Not Matched", "highlightName": not match})
        return result
    return _run(session, token, operation, team_id=team_id)


def own_records(session: Session, token: str, kind: str, offset: int, limit: int):
    with session.begin():
        actor = require_actor(session, token, role="Student")
        # Expire only competitions linked to this user's records, in stable lock order.
        comp_ids = set(session.scalars(select(Application.competition_id).where(Application.applicant_id == actor.id)))
        comp_ids.update(session.scalars(select(Membership.competition_id).where(Membership.student_id == actor.id)))
        for comp_id in sorted(comp_ids):
            comp = session.scalar(select(Competition).where(Competition.id == comp_id).with_for_update())
            expire_competition(session, comp)
        if kind == "applications":
            return [application_view(session, a) for a in session.scalars(select(Application).where(Application.applicant_id == actor.id)
                    .order_by(Application.created_at.desc(), Application.id).offset(offset).limit(limit))]
        if kind == "history":
            return [{"id": m.id, "teamName": t.name, "competitionId": t.competition_id, "status": m.status,
                     "joinedAt": m.joined_at, "endedAt": m.ended_at, "reason": m.end_reason}
                    for m, t in session.execute(select(Membership, Team).join(Team, Team.id == Membership.team_id)
                    .where(Membership.student_id == actor.id).order_by(Membership.joined_at.desc(), Membership.id).offset(offset).limit(limit))]
        return [team_view(session, t) for t in session.scalars(select(Team).join(Membership, Membership.team_id == Team.id)
                .where(Membership.student_id == actor.id, Membership.status == "Active").order_by(Team.id).offset(offset).limit(limit))]


def recruitment_list(session: Session, competition_id: str, offset: int, limit: int):
    with session.begin():
        comp = session.scalar(select(Competition).where(Competition.id == competition_id, Competition.published.is_(True)).with_for_update())
        if not comp:
            raise DomainError("NOT_FOUND", "Competition not found.", 404)
        expire_competition(session, comp)
        return [team_view(session, t) for t in session.scalars(select(Team).where(Team.competition_id == competition_id,
                Team.publication == "Published", Team.lifecycle == "Active").order_by(Team.id).offset(offset).limit(limit))]


def team_detail(session: Session, team_id: str, token: str | None):
    with session.begin():
        team = session.get(Team, team_id)
        if not team:
            raise DomainError("NOT_FOUND", "Team not found.", 404)
        comp = session.scalar(select(Competition).where(Competition.id == team.competition_id).with_for_update())
        expire_competition(session, comp)
        session.refresh(team)
        actor = require_actor(session, token) if token else None
        member = current_membership(session, actor.id, team.competition_id) if actor else None
        own = member and member.team_id == team.id and team.lifecycle == "Active"
        if team.lifecycle != "Active" or ((team.publication != "Published" or not comp.published or comp.deleted) and not own):
            raise DomainError("NOT_FOUND", "Recruitment is not publicly available.", 404)
        result = team_view(session, team)
        if actor and actor.role == "Student":
            result["match"] = "Matched" if get_skill_ids(session, actor.id) & {s["id"] for s in result["skills"]} else "Not Matched"
        return result


def recruitment_revisions(session: Session, token: str, team_id: str):
    def operation(actor, comp, team):
        require_captain(team, actor)
        return [{"id": r.id, "status": r.status, "payload": r.payload, "reason": r.reason,
                 "createdAt": r.created_at} for r in session.scalars(select(RecruitmentRevision)
                 .where(RecruitmentRevision.team_id == team.id).order_by(RecruitmentRevision.created_at.desc()).limit(100))]
    return _run(session, token, operation, team_id=team_id)


def moderation_queue(session: Session, token: str, offset: int, limit: int):
    with session.begin():
        require_actor(session, token, role="Admin")
        return [{"id": r.id, "teamId": r.team_id, "status": r.status, "proposed": r.payload}
                for r in session.scalars(select(RecruitmentRevision).where(RecruitmentRevision.status == "Pending")
                .order_by(RecruitmentRevision.created_at, RecruitmentRevision.id).offset(offset).limit(limit))]


def moderate(session: Session, token: str, revision_id: str, decision: str | None, reason: str = ""):
    def operation(actor, competition, team):
        rev = session.scalar(select(RecruitmentRevision).where(RecruitmentRevision.id == revision_id)
                             .with_for_update().execution_options(populate_existing=True))
        if decision is None:
            return {"id": rev.id, "teamId": team.id, "status": rev.status, "proposed": rev.payload,
                    "effective": team_view(session, team), "reason": rev.reason}
        if team.lifecycle != "Active" or team.recruitment_removed or team.latest_revision_id != rev.id or rev.status != "Pending":
            raise DomainError("STALE_REVISION", "Cannot moderate a stale, deleted or processed revision.")
        if decision == "Approved":
            data = TeamFields.model_validate(rev.payload)
            validate_fields(session, data, competition, count_members(session, team.id))
            team.name, team.summary, team.capacity = data.name, data.summary, data.capacity
            replace_skills(session, team, data.skill_ids)
            team.publication, team.approved_revision_id = "Published", rev.id
            close_full_team(session, team)
        else:
            team.publication = "Delisted" if team.approved_revision_id else "Rejected"
        rev.status, rev.reason, rev.reviewer_id, rev.decided_at = decision, reason or None, actor.id, now()
        notify(session, team.captain_id, "Moderation" + decision, "team", team.id, "Recruitment " + decision.lower() + ".")
        return {"id": rev.id, "status": rev.status, "team": team_view(session, team)}
    return _run(session, token, operation, revision_id=revision_id, role="Admin")


def remove_recruitment(session: Session, token: str, team_id: str):
    def operation(actor, comp, team):
        team.recruitment_removed, team.publication = True, "Delisted"
        if team.latest_revision_id:
            rev = session.get(RecruitmentRevision, team.latest_revision_id)
            if rev.status == "Pending":
                rev.status = "Superseded"
        notify(session, team.captain_id, "RecruitmentRemoved", "team", team.id, "Recruitment removed for a violation.")
        return {"status": "ok"}
    return _run(session, token, operation, team_id=team_id, role="Admin")


def expire_all(session: Session) -> int:
    with session.begin():
        rows = session.scalars(select(Competition).where(Competition.registration_deadline <= now())
                               .order_by(Competition.id).with_for_update()).all()
        for comp in rows:
            expire_competition(session, comp)
        return len(rows)
