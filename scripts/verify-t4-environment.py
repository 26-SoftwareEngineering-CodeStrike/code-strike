"""Reports the environment the T4 evidence was collected in.

Only the version, the schema and the migration state are printed; no
credential, token or contact detail leaves this script.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'apps' / 'server'))

from sqlalchemy import text  # noqa: E402

from app.db.session import get_session  # noqa: E402


def main():
    generator = get_session()
    session = next(generator)
    try:
        print('mysql version :', session.scalar(text('SELECT VERSION()')))
        print('database      :', session.execute(text('SELECT DATABASE()')).scalar())
        print('alembic head  :', session.execute(text('SELECT version_num FROM alembic_version')).scalar())
        print('isolation     :', session.execute(text('SELECT @@transaction_isolation')).scalar())
    finally:
        generator.close()


if __name__ == '__main__':
    main()
