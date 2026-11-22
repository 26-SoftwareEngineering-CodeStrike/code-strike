from datetime import timedelta
import pytest
from sqlalchemy import select
from app.core.config import get_settings
from app.core.exceptions import DomainError
from app.modules.auth.mailer import get_mailer
from app.modules.auth.models import EmailCode, utcnow
from test_auth_profiles import auth_api, signup


class TestMailer:
    __test__ = False
    def __init__(self):
        self.sent = []
    def send_code(self, email, code, purpose):
        self.sent.append((email, code, purpose))


def test_single_use_binding_and_password_recovery(auth_api):
    client, factory, app = auth_api
    mailer = TestMailer()
    app.dependency_overrides[get_mailer] = lambda: mailer
    headers = signup(client)
    email = 'alice@example.org'
    assert client.post('/api/v1/auth/email/code', headers=headers, json={'email': email}).status_code == 200
    code = mailer.sent[-1][1]
    wrong = '999999' if code != '999999' else '111111'
    verify = '/api/v1/auth/email/verify'
    assert client.post(verify, headers=headers, json={'email': email, 'code': wrong}).status_code == 422
    assert client.post(verify, headers=headers, json={'email': email, 'code': code}).status_code == 200
    assert client.post(verify, headers=headers, json={'email': email, 'code': code}).status_code == 422
    assert client.get('/api/v1/auth/me', headers=headers).json()['email'] == email
    assert client.post('/api/v1/auth/password/recovery/code', json={'email': email}).status_code == 200
    recovery = mailer.sent[-1][1]
    with factory.begin() as s:
        row = s.scalar(select(EmailCode).where(EmailCode.purpose == 'recover'))
        assert recovery not in row.code_hash and row.delivered
        row.expires_at = utcnow()-timedelta(seconds=1)
    payload = dict(email=email, code=recovery, newPassword='New-password-6789')
    assert client.post('/api/v1/auth/password/recovery', json=payload).status_code == 422
    with factory.begin() as s:
        row = s.scalar(select(EmailCode).where(EmailCode.purpose == 'recover'))
        row.sent_at = utcnow()-timedelta(hours=1)
    assert client.post('/api/v1/auth/password/recovery/code', json={'email': email}).status_code == 200
    payload['code'] = mailer.sent[-1][1]
    assert client.post('/api/v1/auth/password/recovery', json=payload).status_code == 200
    assert client.post('/api/v1/auth/password/recovery', json=payload).status_code == 422
    assert client.get('/api/v1/auth/me', headers=headers).status_code == 401
    assert client.post('/api/v1/auth/login', json={'username': 'alice', 'password': 'New-password-6789'}).status_code == 200


def test_retry_limits_and_no_smtp_false_success(auth_api, monkeypatch):
    client, factory, app = auth_api
    headers = signup(client)
    monkeypatch.delenv('SMTP_HOST', raising=False)
    monkeypatch.delenv('SMTP_FROM', raising=False)
    get_settings.cache_clear()
    try:
        r = client.post('/api/v1/auth/email/code', headers=headers, json={'email': 'alice@example.org'})
        assert r.status_code == 503 and r.json()['code'] == 'EMAIL_UNAVAILABLE'
        monkeypatch.setenv('AUTH_MAX_ATTEMPTS', '2')
        get_settings.cache_clear()
        for _ in range(2):
            assert client.post('/api/v1/auth/login', json={'username': 'alice', 'password': 'bad'}).status_code == 401
        assert client.post('/api/v1/auth/login', json={'username': 'alice', 'password': 'bad'}).status_code == 429
    finally:
        get_settings.cache_clear()


def test_code_attempt_exhaustion_and_delivery_failure(auth_api, monkeypatch):
    client, factory, app = auth_api
    headers = signup(client)
    mailer = TestMailer()
    app.dependency_overrides[get_mailer] = lambda: mailer
    monkeypatch.setenv('EMAIL_CODE_MAX_ATTEMPTS', '1')
    get_settings.cache_clear()
    try:
        assert client.post('/api/v1/auth/email/code', headers=headers, json={'email': 'alice@example.org'}).status_code == 200
        code = mailer.sent[-1][1]
        wrong = '111111' if code != '111111' else '222222'
        assert client.post('/api/v1/auth/email/verify', headers=headers, json={'email': 'alice@example.org', 'code': wrong}).status_code == 422
        assert client.post('/api/v1/auth/email/verify', headers=headers, json={'email': 'alice@example.org', 'code': code}).status_code == 422
        with factory.begin() as s:
            s.scalar(select(EmailCode)).sent_at = utcnow()-timedelta(hours=1)
        class FailingMailer:
            def send_code(self, *args):
                raise DomainError('EMAIL_UNAVAILABLE', 'Test delivery failure', 503)
        app.dependency_overrides[get_mailer] = lambda: FailingMailer()
        assert client.post('/api/v1/auth/email/code', headers=headers, json={'email': 'alice@example.org'}).status_code == 503
        with factory() as s:
            row = s.scalar(select(EmailCode))
            assert row.consumed and not row.delivered
    finally:
        get_settings.cache_clear()
