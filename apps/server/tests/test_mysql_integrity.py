"""Real MySQL 8.4 constraints and races. Never interpreted as SQLite evidence."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
import pytest
from app.core.exceptions import DomainError
from app.modules.profiles.models import ProfileSkill
from app.modules.teams import service
from app.modules.teams.models import Application, Membership, Team, now
from app.modules.teams.schemas import TeamCreate
from test_teams import competition, team_factory, apply


@pytest.fixture(autouse=True)
def mysql_only(db_session_factory):
    with db_session_factory() as s:
        if s.bind.dialect.name != 'mysql':
            pytest.skip('Requires TEST_MYSQL_URL to a real MySQL 8.4 instance.')
        assert s.scalar(text('SELECT VERSION()')).startswith('8.4.')
        assert s.scalar(text('SELECT @@transaction_isolation')) == 'READ-COMMITTED'


def race(functions):
    barrier = Barrier(len(functions))
    def run(fn):
        barrier.wait(timeout=15)
        try:
            return fn()
        except DomainError as e:
            return e
    with ThreadPoolExecutor(max_workers=len(functions)) as pool:
        return list(pool.map(run, functions))


def raw(headers):
    return headers['Authorization'].split(' ', 1)[1]


def test_generated_nullable_unique_guards(db_session_factory, team_factory, make_user, competition, client):
    team, captain_id, captain, _ = team_factory()
    other_team, _, _, _ = team_factory()
    uid, student = make_user(complete=True)
    application = apply(client, team, student)
    with db_session_factory() as s:
        with pytest.raises(IntegrityError), s.begin():
            s.add(Application(applicant_id=uid, team_id=team['id'], competition_id=competition))
            s.flush()
    with db_session_factory() as s:
        with pytest.raises(IntegrityError), s.begin():
            s.add(Membership(student_id=captain_id, team_id=other_team['id'], competition_id=competition))
            s.flush()
    with db_session_factory.begin() as s:
        # Multiple NULL guards must permit terminal historical rows with identical business keys.
        for _ in range(2):
            s.add(Application(applicant_id=uid, team_id=team['id'], competition_id=competition, status='Rejected'))
            s.add(Membership(student_id=uid, team_id=team['id'], competition_id=competition,
                             status='Ended', ended_at=now()))
    with db_session_factory() as s:
        assert s.scalar(select(func.count()).select_from(Application).where(Application.applicant_id == uid)) == 3
        assert s.scalar(select(func.count()).select_from(Membership).where(Membership.student_id == uid)) == 2
        ddl = s.execute(text('SHOW CREATE TABLE applications')).first()[1]
        assert 'GENERATED ALWAYS' in ddl and 'STORED' in ddl and 'uq_pending_application' in ddl


def test_concurrent_last_places(db_session_factory, team_factory, make_user, client):
    team, _, captain, _ = team_factory(capacity=3)
    applications = [apply(client, team, make_user(complete=True)[1]) for _ in range(4)]
    def approve(a):
        with db_session_factory() as s:
            return service.application_action(s, raw(captain), a['id'], 'Approved')
    results = race([lambda a=a: approve(a) for a in applications])
    assert sum(isinstance(x, dict) for x in results) == 2
    assert all(isinstance(x, dict) or x.message == 'This team is full.' for x in results)
    with db_session_factory() as s:
        assert service.count_members(s, team['id']) == 3
        assert sorted(s.scalars(select(Application.status).where(Application.team_id == team['id']))) == ['Approved', 'Approved', 'Invalidated', 'Invalidated']


def test_concurrent_two_teams_same_applicant(db_session_factory, team_factory, make_user, client, competition):
    t1, _, h1, _ = team_factory()
    t2, _, h2, _ = team_factory()
    uid, headers = make_user(complete=True)
    a1, a2 = apply(client, t1, headers), apply(client, t2, headers)
    def approve(h, a):
        with db_session_factory() as s:
            return service.application_action(s, raw(h), a['id'], 'Approved')
    results = race([lambda: approve(h1, a1), lambda: approve(h2, a2)])
    assert sum(isinstance(x, dict) for x in results) == 1
    with db_session_factory() as s:
        assert s.scalar(select(func.count()).select_from(Membership).where(Membership.student_id == uid, Membership.status == 'Active')) == 1
        assert sorted(s.scalars(select(Application.status).where(Application.applicant_id == uid))) == ['Approved', 'Invalidated']


def test_concurrent_create_and_duplicate_apply(db_session_factory, team_factory, make_user, competition):
    team, _, _, _ = team_factory()
    uid, headers = make_user(complete=True)
    def submit():
        with db_session_factory() as s:
            return service.apply(s, raw(headers), team['id'])
    results = race([submit, submit])
    assert sum(isinstance(x, dict) for x in results) == 1
    with db_session_factory() as s:
        skills = list(s.scalars(select(ProfileSkill.skill_id).where(ProfileSkill.user_id == uid)))
    data = TeamCreate(competitionId=competition, name='Race team', summary='Test', capacity=2, skillIds=skills)
    def create():
        with db_session_factory() as s:
            return service.create_team(s, raw(headers), data)
    results = race([create, create])
    assert sum(isinstance(x, dict) for x in results) == 1
    with db_session_factory() as s:
        assert s.scalar(select(func.count()).select_from(Membership).where(Membership.student_id == uid, Membership.status == 'Active')) == 1
        assert s.scalar(select(Application.status).where(Application.applicant_id == uid)) == 'Invalidated'


def test_withdraw_approve_race(db_session_factory, team_factory, make_user, client):
    team, _, captain, _ = team_factory()
    uid, student = make_user(complete=True)
    a = apply(client, team, student)
    def action(headers, status):
        with db_session_factory() as s:
            return service.application_action(s, raw(headers), a['id'], status)
    results = race([lambda: action(student, 'Withdrawn'), lambda: action(captain, 'Approved')])
    assert sum(isinstance(x, dict) for x in results) == 1
    with db_session_factory() as s:
        application = s.get(Application, a['id'])
        membership = service.current_membership(s, uid, application.competition_id)
        assert (application.status, membership is not None) in [('Approved', True), ('Withdrawn', False)]
