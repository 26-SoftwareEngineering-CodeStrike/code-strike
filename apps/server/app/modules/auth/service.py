"""Service transactions; failure counters are committed before errors leave the service."""
import secrets
from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import DomainError
from app.core.security import hash_password, require_actor, token_digest, verify_password
from app.modules.auth.models import AuthAttempt, AuthToken, EmailCode, User, new_id, utcnow


def user_payload(user: User) -> dict:
    return dict(id=user.id, username=user.username, role=user.role, email=user.email)


def _issue(session: Session, user: User) -> dict:
    token = secrets.token_urlsafe(32)
    ttl = get_settings().token_ttl_seconds
    session.add(AuthToken(digest=token_digest(token), user_id=user.id,
                          expires_at=utcnow() + timedelta(seconds=ttl)))
    return dict(accessToken=token, tokenType='bearer', expiresIn=ttl, user=user_payload(user))


def _limit(session: Session, scope: str) -> DomainError | None:
    """DB-backed per-identity fixed window; lock persists across worker processes.

    A savepoint handles concurrent first-use insertion without aborting the outer transaction.
    All attempts count, including successful ones; keys contain no raw email/username.
    """
    key = token_digest(scope)
    row = session.scalar(select(AuthAttempt).where(AuthAttempt.key == key).with_for_update())
    if row is None:
        try:
            with session.begin_nested():
                session.add(AuthAttempt(key=key, started_at=utcnow(), count=0))
                session.flush()
        except IntegrityError:
            pass
        row = session.scalar(select(AuthAttempt).where(AuthAttempt.key == key).with_for_update())
    settings = get_settings()
    if row.started_at + timedelta(seconds=settings.auth_window_seconds) <= utcnow():
        row.started_at, row.count = utcnow(), 0
    if row.count >= settings.auth_max_attempts:
        return DomainError('RATE_LIMITED', 'Too many attempts; retry after the current window.', 429)
    row.count += 1
    return None


def register(session: Session, data) -> dict:
    with session.begin():
        if session.scalar(select(User.id).where(User.username == data.username)):
            raise DomainError('USERNAME_EXISTS', 'Username is already registered.')
        user = User(username=data.username, password_hash=hash_password(data.password), role='Student')
        session.add(user)
        session.flush()
        from app.modules.profiles.models import Profile
        session.add(Profile(user_id=user.id))
        result = _issue(session, user)
    return result


def login(session: Session, data) -> dict:
    result = None
    with session.begin():
        error = _limit(session, 'login:' + data.username)
        if error is None:
            user = session.scalar(select(User).where(User.username == data.username).with_for_update())
            if user is None:
                # Match the PBKDF work for existing accounts without storing a dummy password.
                hash_password(data.password)
                error = DomainError('INVALID_CREDENTIALS', 'Invalid username or password.', 401)
            elif not verify_password(data.password, user.password_hash):
                error = DomainError('INVALID_CREDENTIALS', 'Invalid username or password.', 401)
            else:
                result = _issue(session, user)
    if error:
        raise error
    return result


def current_user(session: Session, token: str) -> dict:
    with session.begin():
        return user_payload(require_actor(session, token))


def _revoke_all(session: Session, user_id: str) -> None:
    session.execute(update(AuthToken).where(AuthToken.user_id == user_id,
                                           AuthToken.revoked_at.is_(None)).values(revoked_at=utcnow()))
    session.execute(update(EmailCode).where(EmailCode.user_id == user_id).values(consumed=True))


def _locked_actor(session: Session, token: str) -> User:
    actor = require_actor(session, token)
    session.scalar(select(User).where(User.id == actor.id).with_for_update()
                   .execution_options(populate_existing=True))
    return require_actor(session, token)


def logout(session: Session, token: str) -> dict:
    with session.begin():
        _locked_actor(session, token)
        session.execute(update(AuthToken).where(AuthToken.digest == token_digest(token))
                        .values(revoked_at=utcnow()))
    return {'message': 'Signed out.'}


def change_password(session: Session, token: str, data) -> dict:
    with session.begin():
        user = _locked_actor(session, token)
        error = _limit(session, 'password:' + user.id)
        if error is None:
            if not verify_password(data.current_password, user.password_hash):
                error = DomainError('INVALID_CREDENTIALS', 'Current password is incorrect.', 401)
            else:
                user.password_hash = hash_password(data.new_password)
                _revoke_all(session, user.id)
    if error:
        raise error
    return {'message': 'Password changed. Sign in again.'}


def send_code(session: Session, data, mailer, token: str | None = None) -> dict:
    purpose = 'bind' if token is not None else 'recover'
    code = f'{secrets.randbelow(1_000_000):06d}'
    reservation_id = None
    with session.begin():
        # All paths lock user before code/attempt rows, matching verification and password changes.
        user = (_locked_actor(session, token) if token is not None else
                session.scalar(select(User).where(User.email == data.email).with_for_update()))
        error = _limit(session, 'send:' + purpose + ':' + (user.id if user else data.email))
        if error is None and user is not None:
            row = session.scalar(select(EmailCode).where(EmailCode.user_id == user.id,
                                                        EmailCode.purpose == purpose).with_for_update())
            settings = get_settings()
            if row and row.sent_at + timedelta(seconds=settings.email_code_cooldown_seconds) > utcnow():
                error = DomainError('CODE_COOLDOWN', 'Wait before requesting another code.', 429)
            else:
                if row is None:
                    row = EmailCode(user_id=user.id, purpose=purpose)
                    session.add(row)
                # Fresh identifier prevents delayed deliveries from enabling a replacement code.
                reservation_id = row.id = new_id()
                row.email, row.code_hash = data.email, hash_password(code)
                row.sent_at = utcnow()
                row.expires_at = utcnow() + timedelta(seconds=settings.email_code_ttl_seconds)
                row.attempts, row.delivered, row.consumed = 0, False, False
    if error:
        raise error
    if reservation_id is not None:
        try:
            mailer.send_code(data.email, code, purpose)  # Deliberately outside DB transaction.
        except Exception:
            with session.begin():
                session.execute(update(EmailCode).where(EmailCode.id == reservation_id)
                                .values(consumed=True))
            raise
        with session.begin():
            session.execute(update(EmailCode).where(EmailCode.id == reservation_id,
                                                   EmailCode.consumed.is_(False))
                            .values(delivered=True))
    return {'message': 'If the account is eligible, a verification code has been sent.'}


def verify_code(session: Session, data, token: str | None = None) -> dict:
    purpose = 'bind' if token is not None else 'recover'
    with session.begin():
        user = (_locked_actor(session, token) if token is not None else
                session.scalar(select(User).where(User.email == data.email).with_for_update()))
        error = _limit(session, 'verify:' + purpose + ':' + (user.id if user else data.email))
        if error is None:
            row = session.scalar(select(EmailCode).where(EmailCode.user_id == user.id,
                                                        EmailCode.purpose == purpose)
                                 .with_for_update()) if user else None
            settings = get_settings()
            if (row is None or row.email != data.email or row.consumed or not row.delivered
                    or row.expires_at <= utcnow() or row.attempts >= settings.email_code_max_attempts):
                error = DomainError('INVALID_CODE', 'Invalid, expired or used verification code.', 422)
            else:
                row.attempts += 1
                if not verify_password(data.code, row.code_hash):
                    error = DomainError('INVALID_CODE', 'Invalid, expired or used verification code.', 422)
                else:
                    row.consumed = True
                    if purpose == 'bind':
                        if session.scalar(select(User.id).where(User.email == data.email, User.id != user.id)):
                            error = DomainError('EMAIL_IN_USE', 'Email address is already bound.')
                        else:
                            user.email = data.email
                            # Codes for the previous bound email must stop working immediately.
                            session.execute(update(EmailCode).where(EmailCode.user_id == user.id,
                                                                   EmailCode.purpose == 'recover')
                                            .values(consumed=True))
                    else:
                        user.password_hash = hash_password(data.new_password)
                        _revoke_all(session, user.id)
    if error:
        raise error
    return {'message': 'Email verified.' if purpose == 'bind' else 'Password reset. Sign in again.'}
