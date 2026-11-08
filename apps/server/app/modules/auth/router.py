from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import bearer_token
from app.db.session import get_session
from app.modules.auth import schemas, service
from app.modules.auth.mailer import get_mailer

router = APIRouter(prefix='/auth', tags=['auth'])


@router.post('/register', status_code=201, response_model=schemas.TokenOut)
def register(data: schemas.Register, session: Session = Depends(get_session)):
    return service.register(session, data)


@router.post('/login', response_model=schemas.TokenOut)
def login(data: schemas.Login, session: Session = Depends(get_session)):
    return service.login(session, data)


@router.get('/me', response_model=schemas.UserOut)
def me(token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.current_user(session, token)


@router.post('/logout', response_model=schemas.MessageOut)
def logout(token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.logout(session, token)


@router.post('/password/change')
def change_password(data: schemas.ChangePassword, token: str = Depends(bearer_token),
                    session: Session = Depends(get_session)):
    return service.change_password(session, token, data)


@router.post('/email/code')
def email_code(data: schemas.EmailRequest, token: str = Depends(bearer_token),
               session: Session = Depends(get_session), mailer=Depends(get_mailer)):
    return service.send_code(session, data, mailer, token)


@router.post('/email/verify')
def verify_email(data: schemas.VerifyEmail, token: str = Depends(bearer_token),
                 session: Session = Depends(get_session)):
    return service.verify_code(session, data, token)


@router.post('/password/recovery/code')
def recovery_code(data: schemas.EmailRequest, session: Session = Depends(get_session),
                  mailer=Depends(get_mailer)):
    return service.send_code(session, data, mailer)


@router.post('/password/recovery')
def recover(data: schemas.RecoverPassword, session: Session = Depends(get_session)):
    return service.verify_code(session, data)
