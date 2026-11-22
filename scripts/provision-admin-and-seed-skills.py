"""Provisions the administrator account and seeds the predefined skill catalog.

The SRS reserves administrator accounts for the project team: they are not
registrable through the public API. This script therefore creates the account
directly in MySQL, then uses it through the ordinary API to maintain the
catalog, exactly as an administrator would.

The password comes from the environment; nothing is printed.
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'apps' / 'server'))

from sqlalchemy import select  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db import session as db_session  # noqa: E402
from app.modules.auth.models import User  # noqa: E402
from app.modules.profiles.models import Profile  # noqa: E402

ADMIN_USERNAME = os.getenv('CODESTRIKE_ADMIN_USERNAME', 'catalog_admin')
ADMIN_PASSWORD = os.getenv('CODESTRIKE_ADMIN_PASSWORD', '')
API_BASE_URL = os.getenv('CODESTRIKE_API_BASE_URL', 'http://127.0.0.1:8000/api/v1')

CATALOG = [
    'Python',
    'Java',
    'Vue',
    'Research',
    'CAD',
    'Product Design',
    'Data Visualization',
    'Mathematical Modeling',
]


def provision_admin() -> str:
    if not ADMIN_PASSWORD:
        raise SystemExit('CODESTRIKE_ADMIN_PASSWORD is required.')
    session = db_session.get_session_factory()()
    try:
        with session.begin():
            user = session.scalar(select(User).where(User.username == ADMIN_USERNAME))
            if user is None:
                user = User(
                    username=ADMIN_USERNAME,
                    password_hash=hash_password(ADMIN_PASSWORD),
                    role='Admin',
                )
                session.add(user)
                session.flush()
                session.add(Profile(user_id=user.id))
                print(f'provisioned administrator {ADMIN_USERNAME}')
            else:
                user.password_hash = hash_password(ADMIN_PASSWORD)
                user.role = 'Admin'
                print(f'reused existing administrator {ADMIN_USERNAME}')
        return user.id
    finally:
        session.close()


def seed_catalog() -> None:
    import httpx

    # trust_env=False keeps the Windows system proxy out of a loopback request.
    with httpx.Client(base_url=API_BASE_URL, timeout=30.0, trust_env=False) as client:
        response = client.post('/auth/login', json={'username': ADMIN_USERNAME, 'password': ADMIN_PASSWORD})
        if response.status_code != 200:
            raise SystemExit(f'admin login failed: {response.status_code} {response.text}')
        token = response.json()['accessToken']
        headers = {'Authorization': f'Bearer {token}'}

        existing = client.get('/skills').json()
        known = {skill['name'] for skill in existing}
        for name in CATALOG:
            if name in known:
                print(f'skill already present: {name}')
                continue
            created = client.post('/skills', json={'name': name}, headers=headers)
            if created.status_code not in (200, 201):
                raise SystemExit(f'skill creation failed for {name}: {created.status_code} {created.text}')
            print(f'created skill: {name}')

        # A student must not be able to extend the catalog.
        student_username = os.getenv('CODESTRIKE_STUDENT_USERNAME', '')
        student_password = os.getenv('CODESTRIKE_STUDENT_PASSWORD', '')
        if student_username and student_password:
            student = client.post('/auth/login', json={'username': student_username, 'password': student_password})
            if student.status_code == 200:
                student_headers = {'Authorization': f"Bearer {student.json()['accessToken']}"}
                blocked = client.post('/skills', json={'name': 'Student Invented Tag'}, headers=student_headers)
                print(f'student skill creation status: {blocked.status_code} {blocked.text.strip()}')


if __name__ == '__main__':
    provision_admin()
    seed_catalog()
