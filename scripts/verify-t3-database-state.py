"""Reads the account state back out of MySQL and proves the expiry path.

The end-to-end tests already prove the API answers correctly. This script
checks the same state directly in the database, so the result does not depend
on the client cache, and it exercises a token that has actually expired.

No token, password or hash is printed.
"""
import os
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'apps' / 'server'))

from sqlalchemy import select  # noqa: E402

from app.core.security import token_digest  # noqa: E402
from app.db import session as db_session  # noqa: E402
from app.modules.auth.models import AuthToken, User, utcnow  # noqa: E402
from app.modules.profiles.models import Profile, ProfileSkill  # noqa: E402
from app.modules.skills.models import Skill  # noqa: E402

USERNAME = os.getenv('CODESTRIKE_TEST_USERNAME', '')
API_BASE_URL = os.getenv('CODESTRIKE_API_BASE_URL', 'http://127.0.0.1:8000/api/v1')
failures = []


def check(condition, label):
    print(('PASS: ' if condition else 'FAIL: ') + label)
    if not condition:
        failures.append(label)


def read_state():
    session = db_session.get_session_factory()()
    try:
        user = session.scalar(select(User).where(User.username == USERNAME))
        if user is None:
            return None
        profile = session.get(Profile, user.id)
        skill_ids = list(
            session.scalars(select(ProfileSkill.skill_id).where(ProfileSkill.user_id == user.id))
        )
        skill_names = list(
            session.scalars(
                select(Skill.name).where(Skill.id.in_(skill_ids)).order_by(Skill.name)
            )
        ) if skill_ids else []
        tokens = list(
            session.scalars(select(AuthToken).where(AuthToken.user_id == user.id))
        )
        return {
            'user': user,
            'profile': profile,
            'skill_ids': skill_ids,
            'skill_names': skill_names,
            'token_count': len(tokens),
            'revoked_count': sum(1 for token in tokens if token.revoked_at is not None),
        }
    finally:
        session.close()


def expired_token_is_refused():
    """Insert a token that already expired and confirm the API refuses it."""
    import httpx

    session = db_session.get_session_factory()()
    try:
        with session.begin():
            user = session.scalar(select(User).where(User.username == USERNAME))
            if user is None:
                raise SystemExit(f'unknown test account {USERNAME}')
            expired = 'expired-' + os.urandom(24).hex()
            session.add(
                AuthToken(
                    digest=token_digest(expired),
                    user_id=user.id,
                    expires_at=utcnow() - timedelta(minutes=5),
                )
            )
    finally:
        session.close()

    with httpx.Client(base_url=API_BASE_URL, timeout=30.0, trust_env=False) as client:
        response = client.get('/auth/me', headers={'Authorization': f'Bearer {expired}'})
    check(response.status_code == 401, f'an expired token is refused with 401 (got {response.status_code})')
    check(
        response.json().get('code') == 'UNAUTHENTICATED',
        'an expired token is refused with the UNAUTHENTICATED code',
    )


def main():
    if not USERNAME:
        raise SystemExit('CODESTRIKE_TEST_USERNAME is required.')
    state = read_state()
    if state is None:
        raise SystemExit(f'no account {USERNAME} in the database.')

    profile = state['profile']
    print(f'account          : {state["user"].username}')
    print(f'role             : {state["user"].role}')
    print(f'password stored  : {"yes" if state["user"].password_hash else "no"} (hash only)')
    print(f'profile name     : {profile.name if profile else None}')
    print(f'profile college  : {profile.college if profile else None}')
    print(f'profile major    : {profile.major if profile else None}')
    print(f'profile year     : {profile.academic_year if profile else None}')
    print(f'profile contact  : {"yes" if (profile and (profile.wechat_id or profile.qq_id)) else "no"}')
    print(f'profile skills   : {", ".join(state["skill_names"]) or "none"}')
    print(f'token rows       : {state["token_count"]} ({state["revoked_count"]} revoked)')

    check(state['user'].role == 'Student', 'the registered account has the Student role')
    check(state['user'].password_hash.startswith('pbkdf2_sha256$'), 'the password is stored as a PBKDF2 hash')
    check(profile is not None and profile.name == 'Alex Chen', 'the profile name is stored in MySQL')
    check(profile is not None and profile.college == 'School of Computer Science', 'the profile college is stored in MySQL')
    check(profile is not None and profile.academic_year == '2026', 'the profile academic year is stored in MySQL')
    check(profile is not None and profile.brief_cv, 'the profile brief CV is stored in MySQL')
    check(profile is not None and bool(profile.wechat_id or profile.qq_id), 'the profile contact is stored in MySQL')
    check(len(state['skill_ids']) > 0, 'the profile skill tags are stored in MySQL')
    check(state['revoked_count'] > 0, 'the signed-out token is marked revoked in MySQL')

    expired_token_is_refused()

    print(f'RESULT: {"PASS" if not failures else "FAIL"} ({len(failures)} failures)')
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    main()
