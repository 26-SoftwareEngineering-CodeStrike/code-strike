from test_content_moderation import approve, competition


def test_moderation_count_tracks_actionable_revisions(client, admin_headers, make_user):
    comp = competition(client, admin_headers)
    _, student = make_user(complete=True)
    path = f"/api/v1/competitions/{comp['id']}/posts"
    post = client.post(path, headers=student, json={'text': 'Team discussion'}).json()
    approve(client, admin_headers, post['revisionId'])
    post_path = f"/api/v1/posts/{post['id']}"
    assert client.patch(post_path, headers=student, json={'text': 'Second revision'}).status_code == 200
    assert client.post(post_path+'/comments', headers=student, json={'text': 'A pending comment'}).status_code == 201

    def check_count(expected):
        assert len(client.get('/api/v1/moderation', headers=admin_headers).json()) == expected
        assert client.get('/api/v1/dashboard', headers=admin_headers).json()['moderationCount'] == expected

    check_count(2)
    result = client.post('/api/v1/moderation/'+post['revisionId'], headers=admin_headers,
                         json={'action': 'Remove', 'reason': 'Duplicate discussion'})
    assert result.status_code == 200
    check_count(0)
    assert client.get(post_path).status_code == 404
    assert client.get('/api/v1/moderation/'+post['revisionId'], headers=admin_headers).json()['removed']
    assert client.get('/api/v1/dashboard', headers=student).status_code == 403
    assert client.get('/api/v1/moderation', headers=student).status_code == 403
    assert client.post('/api/v1/auth/logout', headers=admin_headers).is_success
    assert client.get('/api/v1/dashboard', headers=admin_headers).status_code == 401
