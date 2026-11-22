"""Auth/profile acceptance and security regressions (SQLite functional coverage)."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture
def auth_api(client, db_session_factory):
    yield client, db_session_factory, client.app


def signup(client, username='alice'):
    response = client.post('/api/v1/auth/register', json={
        'username': username, 'password': 'Password-12345'})
    assert response.status_code == 201, response.text
    return {'Authorization': 'Bearer ' + response.json()['accessToken']}


def test_registration_login_revocation(auth_api):
    client, factory, _ = auth_api
    headers = signup(client)
    assert client.post('/api/v1/auth/register', json={
        'username': 'alice', 'password': 'Password-12345'}).status_code == 409
    assert client.post('/api/v1/auth/register', json={
        'username': 'admin', 'password': 'Password-12345', 'role': 'Admin'}).status_code == 422
    assert client.post('/api/v1/auth/login', json={
        'username': 'alice', 'password': 'wrong'}).status_code == 401
    assert client.get('/api/v1/auth/me', headers=headers).json()['role'] == 'Student'
    assert client.post('/api/v1/auth/password/change', headers=headers, json={
        'currentPassword': 'Password-12345', 'newPassword': 'Replacement-123'}).status_code == 200
    assert client.get('/api/v1/auth/me', headers=headers).status_code == 401
    assert client.post('/api/v1/auth/login', json={
        'username': 'alice', 'password': 'Password-12345'}).status_code == 401
    login = client.post('/api/v1/auth/login', json={
        'username': 'alice', 'password': 'Replacement-123'})
    assert login.status_code == 200
    headers = {'Authorization': 'Bearer ' + login.json()['accessToken']}
    assert client.post('/api/v1/auth/logout', headers=headers).status_code == 200
    assert client.get('/api/v1/auth/me', headers=headers).status_code == 401


def test_profile_gate_privacy_and_skills(auth_api):
    from app.core.exceptions import DomainError
    from app.modules.auth.models import User
    from app.modules.profiles.service import require_complete_profile, profile_preview, get_skill_ids
    client, factory, _ = auth_api
    headers = signup(client)
    admin = signup(client, 'operator')
    with factory.begin() as db:
        db.scalar(select(User).where(User.username == 'operator')).role = 'Admin'
        user_id = db.scalar(select(User).where(User.username == 'alice')).id
    with factory.begin() as db:
        with pytest.raises(DomainError) as error:
            require_complete_profile(db, user_id)
        assert error.value.status == 422
    assert client.post('/api/v1/skills', headers=headers, json={'name': 'Python'}).status_code == 403
    skill = client.post('/api/v1/skills', headers=admin, json={'name': 'Python'})
    assert skill.status_code == 201, skill.text
    skill_id = skill.json()['id']
    payload = dict(name='Alice', college='Engineering', major='CS', academicYear='2',
                   sex='Female', briefCv='I build software.', wechatId='private-id',
                   skillIds=[skill_id])
    assert client.put('/api/v1/profiles/me', headers=headers, json=payload).status_code == 200
    assert client.get('/api/v1/profiles/' + user_id, headers=admin).status_code == 404
    assert client.patch('/api/v1/skills/' + skill_id, headers=admin,
                        json={'name': 'Python programming'}).status_code == 200
    with factory.begin() as db:
        require_complete_profile(db, user_id)
        assert get_skill_ids(db, user_id) == {skill_id}
        preview = profile_preview(db, user_id)
        assert set(preview) == {'name', 'college', 'sex', 'skills', 'briefCv'}
        assert preview['skills'][0]['name'] == 'Python programming'
