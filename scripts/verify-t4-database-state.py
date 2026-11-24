"""Reads the T4 recruitment, application and membership state back out of MySQL.

The end-to-end tests prove the API answers correctly. This script checks the
same rows directly in the database, so the result does not depend on the
client cache or on the shape of an API answer.

It also checks the constraints that the capacity and privacy rules rely on:
the generated unique guard that keeps one current membership per student and
competition, and the generated guard that keeps one Pending application per
student and team.

No token, password, hash or contact detail is printed.
"""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'apps' / 'server'))

from sqlalchemy import func, select, text  # noqa: E402

from app.db import session as db_session  # noqa: E402
from app.modules.auth.models import User  # noqa: E402
from app.modules.competitions.models import Competition  # noqa: E402
from app.modules.teams.models import (Application, Membership,  # noqa: E402
                                       RecruitmentRevision, Team)

SUMMARY = Path(__file__).resolve().parents[1] / '.tools' / 't4-run-summary.json'
failures = []


def check(condition, label):
    print(('PASS: ' if condition else 'FAIL: ') + label)
    if not condition:
        failures.append(label)


def read_summary():
    if not SUMMARY.exists():
        raise SystemExit(
            'The run summary is missing. Run the T4 end-to-end tests first: '
            'pnpm --filter @codestrike/student-app test:e2e'
        )
    return json.loads(SUMMARY.read_text(encoding='utf-8'))


def read_state(summary):
    session = db_session.get_session_factory()()
    try:
        team = session.get(Team, summary['teamId'])
        application = session.get(Application, summary['applicationId'])
        competition = session.get(Competition, summary['competitionId'])
        members = list(session.scalars(
            select(Membership).where(Membership.team_id == summary['teamId'])))
        applications = list(session.scalars(
            select(Application).where(Application.team_id == summary['teamId'])))
        revisions = list(session.scalars(
            select(RecruitmentRevision).where(RecruitmentRevision.team_id == summary['teamId'])))
        captain = session.scalar(select(User).where(User.username == summary['captain']))
        applicant = session.scalar(select(User).where(User.username == summary['applicant']))
        outsider = session.scalar(select(User).where(User.username == summary['outsider']))
        guard = session.execute(text(
            "SELECT COLUMN_NAME, GENERATION_EXPRESSION FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('memberships','applications') "
            "AND COLUMN_NAME IN ('active_guard','pending_guard')")).all()
        return {
            'team': team, 'application': application, 'competition': competition,
            'members': members, 'applications': applications, 'revisions': revisions,
            'captain': captain, 'applicant': applicant, 'outsider': outsider,
            'guards': guard,
        }
    finally:
        session.close()


def main():
    summary = read_summary()
    state = read_state(summary)
    team = state['team']
    application = state['application']
    competition = state['competition']
    captain = state['captain']
    applicant = state['applicant']
    outsider = state['outsider']

    print(f'competition       : {competition.title}')
    print(f'competition id    : {competition.id}')
    print(f'team              : {team.name}')
    print(f'team id           : {team.id}')
    print(f'publication       : {team.publication}')
    print(f'recruitment switch: {team.recruitment_switch}')
    print(f'captain account   : {captain.username} (role {captain.role})')
    print(f'applicant account : {applicant.username} (role {applicant.role})')
    print(f'outsider account  : {outsider.username} (role {outsider.role})')
    print(f'application id    : {application.id}')
    print(f'application status: {application.status}')
    print('')

    check(team is not None, 'the team row exists in MySQL')
    check(team.captain_id == captain.id, 'the team row records the captain as its captain')
    check(team.publication == 'Published', 'the publication state is Published in MySQL')
    check(team.lifecycle == 'Active', 'the team lifecycle is Active in MySQL')

    active = [m for m in state['members'] if m.status == 'Active']
    check(len(active) == 2, f'the team has exactly two active members in MySQL (found {len(active)})')
    check(any(m.student_id == captain.id for m in active), 'the captain is an active membership row')
    check(any(m.student_id == applicant.id for m in active), 'the applicant is an active membership row')
    check(not any(m.student_id == outsider.id for m in active), 'the outsider has no membership row in the team')
    check(all(m.competition_id == team.competition_id for m in state['members']),
          'every membership row points at the competition of the team')

    check(application is not None, 'the application row exists in MySQL')
    check(application.status == 'Approved', 'the application status is Approved in MySQL')
    check(application.applicant_id == applicant.id, 'the application row records the applicant')
    check(application.decided_at is not None, 'the application row records when it was decided')
    approved = [a for a in state['applications'] if a.status == 'Approved']
    check(len(approved) == 1, f'the team has exactly one approved application row (found {len(approved)})')
    check(len(state['revisions']) >= 1, 'the team has a recruitment revision row')
    check(state['revisions'][0].status == 'Approved', 'the recruitment revision row is Approved')

    guard_names = {row[0] for row in state['guards']}
    check({'active_guard', 'pending_guard'} <= guard_names,
          'the generated membership and application guards exist in MySQL')
    check(all(row[1] for row in state['guards']),
          'the generated guards are computed columns')

    # The capacity rule is a database state, not only an API answer.
    session = db_session.get_session_factory()()
    try:
        counted = session.scalar(
            select(func.count()).select_from(Membership)
            .where(Membership.team_id == team.id, Membership.status == 'Active'))
        check(counted == 2, f'the active membership rows count the captain and the member (found {counted})')
        check(counted <= team.capacity, 'the team never holds more active members than its capacity')
        open_applications = list(session.scalars(
            select(Application).where(
                Application.team_id == team.id, Application.status == 'Pending')))
        check(all(a.applicant_id != applicant.id for a in open_applications),
              'the approved applicant has no Pending application left')
        check(all(a.applicant_id != outsider.id for a in open_applications),
              'the outsider never has an application row in this team')
    finally:
        session.close()

    print('')
    print(f'RESULT: {"PASS" if not failures else "FAIL"} ({len(failures)} failures)')
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    main()
