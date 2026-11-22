"""Content/competition acceptance tests using the main application's shared fixtures."""
from datetime import datetime, timedelta, timezone
import base64
import struct
import zlib

import pytest


def competition(client, admin_headers, **changes):
    body = dict(title='Code challenge', description='Build something', category='Software',
                registrationDeadline=(datetime.now(timezone.utc) + timedelta(days=10)).isoformat(),
                eligibilityRules='Students', maxTeamSize=5, officialSourceUrl='https://example.org/contest')
    body.update(changes)
    response = client.post('/api/v1/competitions', headers=admin_headers, json=body)
    assert response.status_code == 201, response.text
    return response.json()


def complete_profile(client, headers, admin_headers):
    skills = client.get('/api/v1/skills').json()
    if not skills:
        skills = [client.post('/api/v1/skills', headers=admin_headers, json={'name': 'Python'}).json()]
    response = client.put('/api/v1/profiles/me', headers=headers, json=dict(
        name='Author', college='Engineering', major='CS', academicYear='2', sex='Female',
        briefCv='Build software', wechatId='private-contact', skillIds=[skills[0]['id']]))
    assert response.status_code == 200, response.text


def approve(client, headers, revision_id):
    response = client.post('/api/v1/moderation/' + revision_id, headers=headers,
                           json={'action': 'Approve'})
    assert response.status_code == 200, response.text


def test_revision_publication_and_irreversible_delete(client, student_headers, other_headers, admin_headers):
    comp = competition(client, admin_headers)
    complete_profile(client, student_headers, admin_headers)
    url = '/api/v1/competitions/' + comp['id'] + '/posts'
    response = client.post(url, headers=student_headers, json={'text': 'First public text'})
    assert response.status_code == 201, response.text
    post = response.json()
    assert client.get(url).json() == []
    approve(client, admin_headers, post['revisionId'])
    assert client.get(url).json()[0]['text'] == 'First public text'
    path = '/api/v1/posts/' + post['id']
    assert client.patch(path, headers=other_headers, json={'text': 'Hijack'}).status_code == 403
    revision = client.patch(path, headers=student_headers, json={'text': 'Second'}).json()
    assert client.get(path).json()['text'] == 'First public text'
    newer = client.patch(path, headers=student_headers, json={'text': 'Third'}).json()
    assert client.post('/api/v1/moderation/' + revision['revisionId'], headers=admin_headers,
                       json={'action': 'Approve'}).status_code == 409
    assert client.delete(path, headers=student_headers).status_code == 204
    assert client.post('/api/v1/moderation/' + newer['revisionId'], headers=admin_headers,
                       json={'action': 'Approve'}).status_code == 409
    assert client.get(path).status_code == 404


def test_student_competition_is_private_until_review(client, student_headers, admin_headers):
    payload = dict(title='Student contest', description='Description', category='Coding',
                   registrationDeadline='2030-01-01T00:00:00Z', eligibilityRules='Students',
                   maxTeamSize=4, officialSourceUrl='https://example.org')
    response = client.post('/api/v1/competition-submissions', headers=student_headers, json=payload)
    assert response.status_code == 201, response.text
    submission = response.json()
    assert client.get('/api/v1/competitions', params={'q': 'Student contest'}).json() == []
    assert client.get('/api/v1/moderation', headers=student_headers).status_code == 403
    approve(client, admin_headers, submission['revisionId'])
    listed = client.get('/api/v1/competitions', params={'q': 'Student contest'}).json()
    assert len(listed) == 1
    assert listed[0]['deadlineStatus'] == 'BeforeDeadline'


def png():
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!IIBBBBB', 1, 1, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(b'\x00\xff\x00\x00')) + chunk(b'IEND', b''))


def test_images_validate_structure():
    from app.modules.content.images import validate_image
    from app.core.exceptions import DomainError
    assert validate_image(png()) == 'image/png'
    for data in (b'not an image', b'\xff\xd8fake\xff\xd9', png()[:-5], png() + b'payload'):
        with pytest.raises(DomainError):
            validate_image(data)
