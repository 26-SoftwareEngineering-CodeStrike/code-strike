from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from app.core.security import bearer_token
from app.db.session import get_session
from . import service
from .schemas import CompetitionCreate, CompetitionInput, CompetitionUpdate, CompetitionDetail

router = APIRouter(tags=['competitions'])


@router.get('/competitions', response_model=list[CompetitionDetail])
def listing(q: str = Query('', max_length=200), offset: int = Query(0, ge=0),
            limit: int = Query(50, ge=1, le=100), session: Session = Depends(get_session)):
    return service.listing(session, q, offset, limit)


@router.get('/admin/competitions', response_model=list[CompetitionDetail])
def admin_listing(q: str = Query('', max_length=200), offset: int = Query(0, ge=0),
                  limit: int = Query(50, ge=1, le=100), token: str = Depends(bearer_token),
                  session: Session = Depends(get_session)):
    return service.listing(session, q, offset, limit, token)


@router.post('/competitions', status_code=201, response_model=CompetitionDetail)
def create(body: CompetitionCreate, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.create(session, token, body)


@router.get('/competitions/{competition_id}', response_model=CompetitionDetail)
def detail(competition_id: str, session: Session = Depends(get_session)):
    return service.detail(session, competition_id)


@router.patch('/competitions/{competition_id}', response_model=CompetitionDetail)
def update(competition_id: str, body: CompetitionUpdate, token: str = Depends(bearer_token),
           session: Session = Depends(get_session)):
    return service.update(session, token, competition_id, body)


@router.delete('/competitions/{competition_id}', status_code=204)
def delete(competition_id: str, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    service.delete(session, token, competition_id)
    return Response(status_code=204)


@router.post('/competition-submissions', status_code=201)
def submit(body: CompetitionInput, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.submit(session, token, body)


@router.get('/competition-submissions/me')
def my_submissions(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
                   token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.my_submissions(session, token, offset, limit)


@router.patch('/competition-submissions/{submission_id}')
def revise(submission_id: str, body: CompetitionInput, token: str = Depends(bearer_token),
           session: Session = Depends(get_session)):
    return service.submit(session, token, body, submission_id)


@router.delete('/competition-submissions/{submission_id}', status_code=204)
def withdraw(submission_id: str, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    service.delete_submission(session, token, submission_id)
    return Response(status_code=204)
