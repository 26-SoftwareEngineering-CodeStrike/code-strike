import base64
from datetime import timedelta
from sqlalchemy import select
from test_content_moderation import competition, complete_profile, approve, png
from app.modules.competitions.models import Competition
from app.modules.teams.models import Application, Team, now


def test_comments_revision_rejection_and_interactions(client, student_headers, other_headers, admin_headers):
    c = competition(client, admin_headers)
    complete_profile(client, student_headers, admin_headers)
    post = client.post(f"/api/v1/competitions/{c['id']}/posts", headers=student_headers, json={'text': 'Old'}).json()
    approve(client, admin_headers, post['revisionId'])
    path = f"/api/v1/posts/{post['id']}"
    rev = client.patch(path, headers=student_headers, json={'text': 'Not approved'}).json()
    assert client.post('/api/v1/moderation/'+rev['revisionId'], headers=admin_headers,
                       json={'action': 'Reject', 'reason': 'Test rejection'}).status_code == 200
    assert client.get(path).json()['text'] == 'Old'
    # Incomplete profiles may comment; this must not acquire the post-only gate.
    comment = client.post(path+'/comments', headers=other_headers, json={'text': 'First comment'})
    assert comment.status_code == 201, comment.text
    assert client.get(path+'/comments').json() == []
    approve(client, admin_headers, comment.json()['revisionId'])
    edited = client.patch('/api/v1/comments/'+comment.json()['id'], headers=other_headers, json={'text': 'New comment'}).json()
    assert client.get(path+'/comments').json()[0]['text'] == 'First comment'
    approve(client, admin_headers, edited['revisionId'])
    assert client.get(path+'/comments').json()[0]['text'] == 'New comment'
    for kind in ['Like', 'Favorite']:
        url = path+'/interactions/'+kind
        assert client.put(url, headers=other_headers).status_code == 200
        assert client.put(url, headers=other_headers).status_code == 200
    counts = client.get(path).json()
    assert counts['likes'] == counts['favorites'] == 1
    assert len(client.get('/api/v1/me/favorites', headers=other_headers).json()) == 1
    for kind in ['Like', 'Favorite']:
        assert client.delete(path+'/interactions/'+kind, headers=other_headers).status_code == 200
    assert client.get(path).json()['likes'] == 0
    pending = client.patch(path, headers=student_headers, json={'text': 'Pending'}).json()
    assert client.post('/api/v1/moderation/'+post['revisionId'], headers=admin_headers,
                       json={'action': 'Remove', 'reason': 'Violation'}).status_code == 200
    assert client.get(path).status_code == 404
    assert client.post('/api/v1/moderation/'+pending['revisionId'], headers=admin_headers, json={'action': 'Approve'}).status_code == 409


def test_image_limits_and_revision_privacy(client, student_headers, other_headers, admin_headers):
    c = competition(client, admin_headers)
    complete_profile(client, student_headers, admin_headers)
    image = {'dataBase64': base64.b64encode(png()).decode()}
    path = f"/api/v1/competitions/{c['id']}/posts"
    assert client.post(path, headers=student_headers, json={'images': [image]*10}).status_code == 422
    post = client.post(path, headers=student_headers, json={'images': [image]*9})
    assert post.status_code == 201, post.text
    image_path = '/api/v1/images/'+post.json()['imageIds'][0]
    assert client.get(image_path).status_code == 404
    assert client.get(image_path, headers=other_headers).status_code == 404
    assert client.get(image_path, headers=student_headers).content == png()
    approve(client, admin_headers, post.json()['revisionId'])
    assert client.get(image_path).content == png()
    assert client.delete('/api/v1/posts/'+post.json()['id'], headers=student_headers).status_code == 204
    assert client.get(image_path).status_code == 404
    huge = {'dataBase64': base64.b64encode(b'x'*(5*1024*1024+1)).decode()}
    assert client.post(path, headers=student_headers, json={'images': [huge]}).status_code == 422


def test_exact_five_megabyte_boundary():
    import struct
    import zlib
    from app.modules.content.images import validate_image, MAX_IMAGE_BYTES
    # Valid PNG ancillary chunk fills the image to the inclusive upload boundary.
    original = png()
    payload = b'comment\0' + b'a' * (MAX_IMAGE_BYTES-len(original)-12-8)
    tag = b'tEXt'
    chunk = struct.pack('!I', len(payload))+tag+payload+struct.pack('!I', zlib.crc32(tag+payload))
    image = original[:-12]+chunk+original[-12:]
    assert len(image) == MAX_IMAGE_BYTES
    assert validate_image(image) == 'image/png'


def test_competition_limits_deadline_and_dashboard(client, make_user, admin_headers, db_session_factory):
    c = competition(client, admin_headers)
    uid, captain = make_user(complete=True)
    from app.modules.profiles.models import ProfileSkill
    with db_session_factory() as s:
        skills = list(s.scalars(select(ProfileSkill.skill_id).where(ProfileSkill.user_id == uid)))
    team = client.post('/api/v1/teams', headers=captain, json=dict(competitionId=c['id'], name='Team',
        summary='Test', capacity=4, skillIds=skills, submitRecruitment=True)).json()
    rev = team['revision']['id']
    assert client.post('/api/v1/moderation/recruitments/'+rev+'/decision', headers=admin_headers,
                       json={'decision': 'Approved'}).status_code == 200
    assert client.patch('/api/v1/competitions/'+c['id'], headers=admin_headers, json={'maxTeamSize': 3}).status_code == 409
    _, student = make_user(complete=True)
    a = client.post('/api/v1/teams/'+team['id']+'/applications', headers=student).json()
    with db_session_factory.begin() as s:
        s.get(Competition, c['id']).registration_deadline = now()-timedelta(seconds=5)
    assert client.patch('/api/v1/competitions/'+c['id'], headers=admin_headers,
                        json={'registrationDeadline': (now()+timedelta(days=2)).isoformat()+'Z'}).status_code == 200
    with db_session_factory() as s:
        assert s.get(Application, a['id']).status == 'Invalidated'
        assert s.get(Team, team['id']).recruitment_switch == 'Closed'
    dash = client.get('/api/v1/dashboard', headers=admin_headers).json()
    assert set(dash) == {'competitionCount','pendingApplicationCount','activeTeamCount','moderationCount','competitions'}
    assert client.get('/api/v1/dashboard', headers=student).status_code == 403
