"""Token extraction never opens a session; callers own the authorization transaction."""
import hashlib
import hmac
import secrets
from typing import Literal

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import DomainError
from app.modules.auth.models import AuthToken, User, utcnow

Role = Literal['Student', 'Admin']
_bearer = HTTPBearer(auto_error=False)
_ITERATIONS = 600_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    value = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), _ITERATIONS)
    return f'pbkdf2_sha256${_ITERATIONS}${salt}${value.hex()}'


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations, salt, expected = encoded.split('$')
        if algorithm != 'pbkdf2_sha256' or not 100_000 <= int(iterations) <= 2_000_000:
            return False
        value = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), int(iterations))
        return hmac.compare_digest(value.hex(), expected)
    except (ValueError, TypeError):
        return False


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def bearer_token(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str:
    if credentials is None or credentials.scheme.lower() != 'bearer':
        raise DomainError('UNAUTHENTICATED', 'Sign in is required.', 401)
    return credentials.credentials


def require_actor(session: Session, token: str, role: Role | None = None) -> User:
    if not session.in_transaction():
        raise RuntimeError('require_actor must run inside the calling service transaction')
    # No locks here: domain services have their own lock order (e.g. competition -> team).
    credential = session.scalar(select(AuthToken).where(AuthToken.digest == token_digest(token))
                                .execution_options(populate_existing=True))
    actor = session.scalar(select(User).where(User.id == credential.user_id)
                           .execution_options(populate_existing=True)) if credential else None
    if actor is None or credential is None or credential.revoked_at or credential.expires_at <= utcnow():
        raise DomainError('UNAUTHENTICATED', 'Invalid or expired session.', 401)
    if actor.role not in ('Student', 'Admin') or (role is not None and actor.role != role):
        raise DomainError('FORBIDDEN', 'This operation is not permitted.', 403)
    return actor
