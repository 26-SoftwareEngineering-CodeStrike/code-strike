from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from app.core.security import bearer_token
from app.db.session import get_session
from . import service
from .schemas import DecisionInput, SwitchInput, TeamCreate, TeamFields, TransferInput
from .schemas import TeamOut, TeamCreated, ApplicationOut, ApplicantPreview, ReviewOut, MemberOut, ContactOut

router = APIRouter(tags=["teams and applications"])
optional_bearer = HTTPBearer(auto_error=False)


@router.post("/teams", status_code=201, response_model=TeamCreated, response_model_exclude_none=True)
def create(body: TeamCreate, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.create_team(session, token, body)


@router.get("/me/teams", response_model=list[TeamOut], response_model_exclude_none=True)
def my_teams(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
             token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.own_records(session, token, "teams", offset, limit)


@router.get("/me/team-history")
def history(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
            token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.own_records(session, token, "history", offset, limit)


@router.get("/me/applications", response_model=list[ApplicationOut])
def my_applications(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
                    token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.own_records(session, token, "applications", offset, limit)


@router.get("/competitions/{competition_id}/recruitments", response_model=list[TeamOut], response_model_exclude_none=True)
def recruitments(competition_id: str, offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
                 session: Session = Depends(get_session)):
    return service.recruitment_list(session, competition_id, offset, limit)


@router.get("/teams/{team_id}", response_model=TeamOut, response_model_exclude_none=True)
def detail(team_id: str, credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer),
           session: Session = Depends(get_session)):
    return service.team_detail(session, team_id, credentials.credentials if credentials else None)


@router.post("/teams/{team_id}/recruitment/revisions", status_code=201)
def revision(team_id: str, body: TeamFields, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.submit_revision(session, token, team_id, body)


@router.get("/teams/{team_id}/recruitment/revisions")
def revisions(team_id: str, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.recruitment_revisions(session, token, team_id)


@router.put("/teams/{team_id}/recruitment/switch")
def switch(team_id: str, body: SwitchInput, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.switch(session, token, team_id, body.state)


@router.post("/teams/{team_id}/applications", status_code=201, response_model=ApplicationOut)
def apply(team_id: str, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.apply(session, token, team_id)


@router.get("/teams/{team_id}/applications", response_model=list[ReviewOut])
def applications(team_id: str, offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
                 token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.review_queue(session, token, team_id, offset, limit)


@router.get("/applications/{application_id}/applicant-profile", response_model=ApplicantPreview)
def profile(application_id: str, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.applicant_profile(session, token, application_id)


@router.post("/applications/{application_id}/withdraw")
def withdraw(application_id: str, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.application_action(session, token, application_id, "Withdrawn")


@router.post("/applications/{application_id}/decision")
def decide(application_id: str, body: DecisionInput, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.application_action(session, token, application_id, body.decision, body.reason)


@router.get("/teams/{team_id}/members", response_model=list[MemberOut])
def members(team_id: str, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.members(session, token, team_id)


@router.get("/teams/{team_id}/members/{member_id}/contact", response_model=ContactOut)
def contact(team_id: str, member_id: str, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.members(session, token, team_id, member_id)


@router.post("/teams/{team_id}/leave")
def leave(team_id: str, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.member_action(session, token, team_id, "leave")


@router.delete("/teams/{team_id}/members/{member_id}")
def remove_member(team_id: str, member_id: str, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.member_action(session, token, team_id, "remove", member_id)


@router.post("/teams/{team_id}/captain")
def transfer(team_id: str, body: TransferInput, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.member_action(session, token, team_id, "transfer", body.member_id)


@router.post("/teams/{team_id}/dissolve")
def dissolve(team_id: str, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.member_action(session, token, team_id, "dissolve")


@router.get("/moderation/recruitments")
def moderation_queue(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
                     token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.moderation_queue(session, token, offset, limit)


@router.get("/moderation/recruitments/{revision_id}")
def moderation_detail(revision_id: str, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.moderate(session, token, revision_id, None)


@router.post("/moderation/recruitments/{revision_id}/decision")
def moderate(revision_id: str, body: DecisionInput, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.moderate(session, token, revision_id, body.decision, body.reason)


@router.delete("/moderation/recruitments/team/{team_id}")
def remove_recruitment(team_id: str, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.remove_recruitment(session, token, team_id)
