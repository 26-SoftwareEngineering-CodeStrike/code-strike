"""API evidence for BR-01..11, current permissions and atomic side effects."""
from datetime import timedelta
import pytest
from sqlalchemy import select
from app.modules.competitions.models import Community, Competition
from app.modules.profiles.models import ProfileSkill
from app.modules.teams.models import Application, Membership, Team, now


@pytest.fixture
def competition(db_session_factory):
    with db_session_factory.begin() as s:
        c = Competition(title="Test competition", description="Test", category="Test",
                        registration_deadline=now()+timedelta(days=7), eligibility_rules="Students",
                        max_team_size=5, official_source_url="https://example.org/contest", published=True)
        s.add(c)
        s.flush()
        s.add(Community(competition_id=c.id))
        return c.id


@pytest.fixture
def team_factory(client, db_session_factory, make_user, competition, admin_headers):
    def create(capacity=3, published=True):
        uid, headers = make_user(complete=True)
        with db_session_factory() as s:
            skills = list(s.scalars(select(ProfileSkill.skill_id).where(ProfileSkill.user_id == uid)))
        body = dict(competitionId=competition, name="Test Team", summary="Test recruitment", capacity=capacity,
                    skillIds=skills, submitRecruitment=published)
        response = client.post("/api/v1/teams", headers=headers, json=body)
        assert response.status_code == 201, response.text
        team = response.json()
        if published:
            r = client.post(f"/api/v1/moderation/recruitments/{team['revision']['id']}/decision",
                            headers=admin_headers, json={"decision": "Approved"})
            assert r.status_code == 200, r.text
        return team, uid, headers, skills
    return create


def apply(client, team, headers):
    r = client.post(f"/api/v1/teams/{team['id']}/applications", headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def decide(client, application, captain, decision="Approved"):
    return client.post(f"/api/v1/applications/{application['id']}/decision", headers=captain,
                       json={"decision": decision})


def test_private_team_captain_capacity_and_profile_gate(client, team_factory, student_headers):
    team, captain_id, captain, skills = team_factory(published=False)
    assert team["memberCount"] == 1
    assert team["publication"] == "Private"
    assert client.get(f"/api/v1/teams/{team['id']}").status_code == 404
    assert client.get(f"/api/v1/teams/{team['id']}", headers=captain).status_code == 200
    r = client.post(f"/api/v1/teams/{team['id']}/applications", headers=student_headers)
    assert r.status_code == 422 and r.json()["details"]
    assert client.post(f"/api/v1/teams/{team['id']}/leave", headers=captain).status_code == 409


def test_multi_apply_approval_invalidation_and_history(client, team_factory, make_user):
    t1, _, c1, _ = team_factory()
    t2, _, c2, _ = team_factory()
    uid, student = make_user(complete=True)
    a1 = apply(client, t1, student)
    assert client.post(f"/api/v1/teams/{t1['id']}/applications", headers=student).status_code == 409
    a2 = apply(client, t2, student)
    queue = client.get(f"/api/v1/teams/{t1['id']}/applications", headers=c1).json()
    assert queue[0]["match"] == "Not Matched" and queue[0]["highlightName"] is True
    assert set(queue[0]["applicant"]) == {"name", "college", "sex", "skills", "briefCv"}
    assert decide(client, a1, c1).status_code == 200
    states = {a["id"]: a["status"] for a in client.get("/api/v1/me/applications", headers=student).json()}
    assert states == {a1["id"]: "Approved", a2["id"]: "Invalidated"}
    assert client.get(f"/api/v1/applications/{a1['id']}/applicant-profile", headers=c1).status_code == 403
    assert client.get(f"/api/v1/teams/{t1['id']}/members/{uid}/contact", headers=c1).json()["wechatId"] == "private-contact"
    assert client.get(f"/api/v1/teams/{t1['id']}/members/{uid}/contact", headers=c2).status_code == 403
    assert client.post(f"/api/v1/teams/{t1['id']}/leave", headers=student).status_code == 200
    assert client.get(f"/api/v1/teams/{t1['id']}/members/{uid}/contact", headers=c1).status_code == 403
    new = apply(client, t1, student)
    assert new["id"] != a1["id"]
    old = client.get("/api/v1/me/applications", headers=student).json()
    assert next(a for a in old if a["id"] == a1["id"])["status"] == "Approved"


def test_full_invalidates_pending_and_never_auto_reopens(client, team_factory, make_user):
    team, _, captain, skills = team_factory(capacity=2)
    u1, s1 = make_user(complete=True)
    _, s2 = make_user(complete=True)
    a1, a2 = apply(client, team, s1), apply(client, team, s2)
    assert decide(client, a1, captain).status_code == 200
    full = decide(client, a2, captain)
    assert full.status_code == 409 and full.json()["message"] == "This team is full."
    assert client.post(f"/api/v1/teams/{team['id']}/applications", headers=s2).json()["message"] == "This team is full."
    assert client.get("/api/v1/me/applications", headers=s2).json()[0]["status"] == "Invalidated"
    assert client.post(f"/api/v1/teams/{team['id']}/leave", headers=s1).status_code == 200
    assert client.get(f"/api/v1/teams/{team['id']}").json()["recruitmentSwitch"] == "Closed"
    assert client.post(f"/api/v1/teams/{team['id']}/applications", headers=s2).status_code == 409


def test_withdraw_reject_reapply_and_transfer_privileges(client, team_factory, make_user):
    team, captain_id, captain, _ = team_factory()
    uid, student = make_user(complete=True)
    a = apply(client, team, student)
    assert client.post(f"/api/v1/applications/{a['id']}/withdraw", headers=student).status_code == 200
    assert client.get(f"/api/v1/applications/{a['id']}/applicant-profile", headers=captain).status_code == 403
    b = apply(client, team, student)
    assert decide(client, b, captain, "Rejected").status_code == 200
    c = apply(client, team, student)
    assert len({a["id"], b["id"], c["id"]}) == 3
    assert decide(client, c, captain).status_code == 200
    r = client.post(f"/api/v1/teams/{team['id']}/captain", headers=captain, json={"memberId": uid})
    assert r.status_code == 200
    assert client.get(f"/api/v1/teams/{team['id']}/members/{uid}/contact", headers=captain).status_code == 403
    assert client.get(f"/api/v1/teams/{team['id']}/applications", headers=captain).status_code == 403
    assert client.get(f"/api/v1/teams/{team['id']}/members/{captain_id}/contact", headers=student).status_code == 200
    assert client.post(f"/api/v1/teams/{team['id']}/captain", headers=student, json={"memberId": "unknown"}).status_code == 409


def test_revision_delists_but_pending_can_be_approved(client, team_factory, make_user, admin_headers):
    team, _, captain, skills = team_factory(capacity=3)
    _, s1 = make_user(complete=True)
    _, s2 = make_user(complete=True)
    a = apply(client, team, s1)
    client.put(f"/api/v1/teams/{team['id']}/recruitment/switch", headers=captain, json={"state": "Closed"})
    revision = client.post(f"/api/v1/teams/{team['id']}/recruitment/revisions", headers=captain,
                           json=dict(name="New", summary="New conditions", capacity=1, skillIds=skills))
    assert revision.status_code == 201, revision.text
    assert client.get(f"/api/v1/teams/{team['id']}").status_code == 404
    assert client.post(f"/api/v1/teams/{team['id']}/applications", headers=s2).status_code == 409
    assert decide(client, a, captain).status_code == 200
    r = client.post(f"/api/v1/moderation/recruitments/{revision.json()['id']}/decision", headers=admin_headers,
                    json={"decision": "Approved"})
    assert r.status_code == 422
    assert client.get(f"/api/v1/teams/{team['id']}", headers=captain).json()["capacity"] == 3
    r = client.post(f"/api/v1/moderation/recruitments/{revision.json()['id']}/decision", headers=admin_headers,
                    json={"decision": "Rejected"})
    assert r.status_code == 200
    assert client.get(f"/api/v1/teams/{team['id']}").status_code == 404


def test_deadline_commits_invalidation_even_when_approval_fails(client, team_factory, make_user, db_session_factory, competition):
    team, _, captain, _ = team_factory()
    _, student = make_user(complete=True)
    a = apply(client, team, student)
    with db_session_factory.begin() as s:
        s.get(Competition, competition).registration_deadline = now()-timedelta(seconds=1)
    assert decide(client, a, captain).json()["code"] == "DEADLINE_PASSED"
    with db_session_factory() as s:
        assert s.get(Application, a["id"]).status == "Invalidated"
        assert s.get(Team, team["id"]).recruitment_switch == "Closed"


def test_dissolution_history_notifications_and_ownership(client, team_factory, make_user, other_headers):
    team, _, captain, _ = team_factory()
    _, student = make_user(complete=True)
    a = apply(client, team, student)
    assert client.post(f"/api/v1/teams/{team['id']}/dissolve", headers=captain).status_code == 200
    assert client.get(f"/api/v1/teams/{team['id']}/members", headers=captain).status_code == 403
    assert client.get("/api/v1/me/applications", headers=student).json()[0]["status"] == "Invalidated"
    history = client.get("/api/v1/me/team-history", headers=captain).json()
    assert len(history) == 1 and history[0]["status"] == "Ended"
    assert "members" not in history[0]
    inbox = client.get("/api/v1/notifications", headers=student).json()
    assert inbox["unreadCount"] >= 1
    notice = inbox["items"][0]
    assert client.get(f"/api/v1/notifications/{notice['id']}", headers=other_headers).status_code == 404
    assert client.patch(f"/api/v1/notifications/{notice['id']}", headers=student, json={"isRead": True}).json()["isRead"]
    assert client.get(f"/api/v1/applications/{a['id']}/applicant-profile", headers=captain).status_code == 403


def test_creation_invalidates_other_pending(client, team_factory, make_user, competition, db_session_factory):
    team, _, _, _ = team_factory()
    uid, student = make_user(complete=True)
    a = apply(client, team, student)
    with db_session_factory() as s:
        skills = list(s.scalars(select(ProfileSkill.skill_id).where(ProfileSkill.user_id == uid)))
    r = client.post("/api/v1/teams", headers=student, json=dict(competitionId=competition, name="Own Team",
                    summary="Test", capacity=2, skillIds=skills))
    assert r.status_code == 201, r.text
    assert client.get("/api/v1/me/applications", headers=student).json()[0]["status"] == "Invalidated"
    assert client.post("/api/v1/teams", headers=student, json=dict(competitionId=competition, name="Duplicate",
                    summary="Test", capacity=2, skillIds=skills)).status_code == 409


@pytest.mark.parametrize('field', ['name', 'college', 'major', 'academic_year', 'sex', 'brief_cv', 'contact', 'skills'])
def test_each_missing_profile_field_blocks_restricted_operations(client, team_factory, make_user,
                                                               db_session_factory, competition, field):
    from sqlalchemy import delete
    from app.modules.profiles.models import Profile
    team, _, _, _ = team_factory()
    uid, headers = make_user(complete=True)
    with db_session_factory.begin() as s:
        ids = list(s.scalars(select(ProfileSkill.skill_id).where(ProfileSkill.user_id == uid)))
        profile = s.get(Profile, uid)
        if field == 'contact':
            profile.wechat_id = profile.qq_id = None
        elif field == 'skills':
            s.execute(delete(ProfileSkill).where(ProfileSkill.user_id == uid))
        else:
            setattr(profile, field, '')
    calls = [client.post(f"/api/v1/teams/{team['id']}/applications", headers=headers),
             client.post('/api/v1/teams', headers=headers, json=dict(competitionId=competition,
                         name='Test', summary='Test', capacity=2, skillIds=ids)),
             client.post(f'/api/v1/competitions/{competition}/posts', headers=headers, json={'text': 'Test'})]
    for response in calls:
        assert response.status_code == 422, response.text
        assert response.json()['details']['missingFields']
    assert client.post('/api/v1/planner/items', headers=headers,
                       json={'kind':'Todo','title':'Still allowed','date':'2030-01-01'}).status_code == 201


def test_recruitment_increase_stays_closed_and_remove_revokes(client, team_factory, make_user, admin_headers):
    team, _, captain, skills = team_factory(capacity=2)
    uid, student = make_user(complete=True)
    assert decide(client, apply(client, team, student), captain).status_code == 200
    body = dict(name='Larger team', summary='Test', capacity=4, skillIds=skills)
    revision = client.post(f"/api/v1/teams/{team['id']}/recruitment/revisions", headers=captain, json=body).json()
    r = client.post('/api/v1/moderation/recruitments/'+revision['id']+'/decision', headers=admin_headers,
                    json={'decision':'Approved'})
    assert r.status_code == 200, r.text
    assert r.json()['team']['recruitmentSwitch'] == 'Closed'
    assert client.delete(f"/api/v1/teams/{team['id']}/members/{uid}", headers=captain).status_code == 200
    assert client.get(f"/api/v1/teams/{team['id']}/members", headers=student).status_code == 403
    assert client.put(f"/api/v1/teams/{team['id']}/recruitment/switch", headers=captain, json={'state':'Open'}).status_code == 200
    assert apply(client, team, student)['status'] == 'Pending'
