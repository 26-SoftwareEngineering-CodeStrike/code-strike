"""Run from apps/server: python scripts/provision_admin.py USERNAME.

Uses DATABASE_URL and existing migrations. Password is prompted, never an argv secret.
Existing accounts are never silently promoted or overwritten.
"""
import argparse
import getpass
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from app.core.security import hash_password
from app.db.session import get_session_factory
from app.modules.auth.models import User
from app.modules.auth.schemas import Register


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('username')
    args = parser.parse_args()
    password = getpass.getpass('Administrator password (10–128 characters): ')
    if password != getpass.getpass('Confirm password: '):
        parser.error('Passwords do not match.')
    data = Register(username=args.username, password=password)
    with get_session_factory()() as session, session.begin():
        if session.scalar(select(User.id).where(User.username == data.username)):
            parser.error('Username already exists. No account was changed.')
        session.add(User(username=data.username, password_hash=hash_password(data.password), role='Admin'))
    print('Administrator provisioned.')


if __name__ == '__main__':
    main()
