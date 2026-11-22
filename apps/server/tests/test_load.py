"""Recorded in-process API benchmark, not a production/network or frontend acceptance test."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from time import perf_counter
import json
import pytest
from test_teams import competition, team_factory


def test_twenty_user_mixed_workload(client, db_session_factory, make_user, admin_headers,
                                  team_factory, competition, record_property):
    from app.modules.competitions.models import Competition
    with db_session_factory.begin() as s:
        if s.bind.dialect.name != 'mysql':
            pytest.skip('Benchmark requires TEST_MYSQL_URL; SQLite is not performance evidence.')
        s.get(Competition, competition).max_team_size = 100
    team, _, _, _ = team_factory(capacity=100)
    participants = []
    for _ in range(20):
        _, headers = make_user(complete=True)
        post = client.post(f'/api/v1/competitions/{competition}/posts', headers=headers, json={'text': 'Load fixture'})
        assert post.status_code == 201
        participants.append((headers, post.json()['revisionId']))
    barrier = Barrier(20)
    def worker(participant):
        headers, revision = participant
        calls = [
            ('read', lambda: client.get('/api/v1/competitions')),
            ('save', lambda: client.post('/api/v1/planner/items', headers=headers,
                         json={'kind': 'Todo', 'title': 'Load test', 'date': '2030-01-01'})),
            ('apply', lambda: client.post(f"/api/v1/teams/{team['id']}/applications", headers=headers)),
            ('moderate', lambda: client.post('/api/v1/moderation/'+revision, headers=admin_headers,
                                             json={'action': 'Approve'})),
        ]
        barrier.wait(timeout=20)
        observations = []
        for kind, call in calls:
            start = perf_counter()
            response = call()
            elapsed = perf_counter()-start
            assert response.status_code in (200, 201), response.text
            observations.append((kind, elapsed))
        return observations
    with ThreadPoolExecutor(max_workers=20) as pool:
        observations = [x for batch in pool.map(worker, participants) for x in batch]
    times = sorted(t for _, t in observations)
    summary = dict(concurrentUsers=20, operations=len(times), failed=0,
                   maximumSeconds=round(max(times), 4), p95Seconds=round(times[int(.95*len(times))-1], 4),
                   targetSeconds=3, targetMet=all(t <= 3 for t in times),
                   scope='Windows local MySQL 8.4 / TestClient ASGI; excludes network and clients')
    for kind in ('read', 'save', 'apply', 'moderate'):
        summary[kind+'MaximumSeconds'] = round(max(t for k, t in observations if k == kind), 4)
    print('\nLOAD_EVIDENCE '+json.dumps(summary))
    record_property('load_evidence', json.dumps(summary))
