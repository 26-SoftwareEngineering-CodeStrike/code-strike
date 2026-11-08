"""Run as a supervised worker; deadline checks also run synchronously on admission."""
import argparse
import logging
import time
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.db.session import get_session_factory
from app.modules.teams.service import expire_all


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--interval", type=float, default=5.0)
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    if args.interval <= 0:
        parser.error("interval must be positive")
    while True:
        try:
            with get_session_factory()() as session:
                expire_all(session)
        except Exception:
            logging.exception("Deadline sweep failed; admission checks still fail closed.")
            if args.once:
                raise
        if args.once:
            return
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
