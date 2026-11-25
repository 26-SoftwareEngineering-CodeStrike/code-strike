"""T8 real MySQL 8.4 concurrency, lock-ordering, and schema-constraint QA tests.

Never interpreted as SQLite evidence; every test asserts MySQL 8.4 under READ-COMMITTED.
"""
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import date, time
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError, OperationalError

from app.core.config import get_settings
from app.core.exceptions import DomainError
from app.modules.content import service as content_service
from app.modules.content.models import Post, PostInteraction, PostRevision
from app.modules.content.schemas import PostInput
from app.modules.moderation import service as moderation_service
from app.modules.moderation.models import ModerationRecord
from app.modules.moderation.schemas import Decision
from app.modules.notifications import service as notification_service
from app.modules.notifications.models import Notification
from app.modules.planner import service as planner_service
from app.modules.planner.models import PlannerItem
from app.modules.planner.schemas import ItemPatch
from test_content_moderation import approve, competition, png


@pytest.fixture(autouse=True)
def mysql_only(db_session_factory):
    with db_session_factory() as s:
        if s.bind.dialect.name != "mysql":
            pytest.skip("Requires TEST_MYSQL_URL pointing to a real MySQL 8.4 instance.")
        assert s.scalar(text("SELECT VERSION()")).startswith("8.4.")
        assert s.scalar(text("SELECT @@transaction_isolation")) == "READ-COMMITTED"


@pytest.fixture
def timetable(monkeypatch):
    monkeypatch.setenv("SEMESTER_START_DATE", "2026-09-07")
    monkeypatch.setenv("PERIOD_TIMES", '{"1":["08:00","08:45"],"2":["08:55","09:40"]}')
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def raw(headers: dict) -> str:
    return headers["Authorization"].split(" ", 1)[1]


def race(functions):
    barrier = Barrier(len(functions))

    def run(fn):
        barrier.wait(timeout=15)
        try:
            return fn()
        except DomainError as exc:
            return exc

    with ThreadPoolExecutor(max_workers=len(functions)) as pool:
        return list(pool.map(run, functions))


def test_mysql_concurrent_moderation_same_post_revision(
    db_session_factory, client, make_user, admin_headers
):
    comp = competition(client, admin_headers)
    author_id, author = make_user(complete=True)
    _, admin_b = make_user(role="Admin")
    post = client.post(
        f"/api/v1/competitions/{comp['id']}/posts",
        headers=author,
        json={"text": "Concurrent moderation race post"},
    ).json()
    rev_id = post["revisionId"]

    def decide(headers, action, reason=None):
        with db_session_factory() as s:
            return moderation_service.decide(
                s, raw(headers), rev_id, Decision(action=action, reason=reason)
            )

    results = race([
        lambda: decide(admin_headers, "Approve"),
        lambda: decide(admin_b, "Reject", "Conflicting concurrent decision"),
    ])
    wins = [r for r in results if isinstance(r, dict)]
    errors = [r for r in results if isinstance(r, DomainError)]
    assert len(wins) == 1
    assert len(errors) == 1
    assert errors[0].code == "STALE_REVISION"
    assert errors[0].status == 409

    with db_session_factory() as s:
        saved_post = s.get(Post, post["id"])
        saved_rev = s.get(PostRevision, rev_id)
        records = list(
            s.scalars(select(ModerationRecord).where(ModerationRecord.revision_id == rev_id))
        )
        notes = list(
            s.scalars(select(Notification).where(Notification.recipient_id == author_id))
        )
        assert len(records) == 1
        assert len(notes) == 1
        if wins[0]["action"] == "Approve":
            assert saved_rev.status == "Approved"
            assert saved_post.public_revision_id == rev_id
            assert notes[0].event == "ModerationApprove"
        else:
            assert saved_rev.status == "Rejected"
            assert saved_post.public_revision_id is None
            assert notes[0].event == "ModerationReject"


def test_mysql_concurrent_post_edit_vs_admin_approve(
    db_session_factory, client, make_user, admin_headers
):
    comp = competition(client, admin_headers)
    _, author = make_user(complete=True)
    post = client.post(
        f"/api/v1/competitions/{comp['id']}/posts",
        headers=author,
        json={"text": "Revision one before race"},
    ).json()
    rev1_id = post["revisionId"]

    def edit_post():
        with db_session_factory() as s:
            return content_service.create_post(
                s,
                raw(author),
                comp["id"],
                PostInput(text="Revision two racing approval"),
                post_id=post["id"],
            )

    def approve_rev1():
        with db_session_factory() as s:
            return moderation_service.decide(
                s, raw(admin_headers), rev1_id, Decision(action="Approve")
            )

    edit_res, approve_res = race([edit_post, approve_rev1])
    assert isinstance(edit_res, dict)
    rev2_id = edit_res["revisionId"]
    assert rev2_id != rev1_id

    with db_session_factory() as s:
        saved_post = s.get(Post, post["id"])
        rev1 = s.get(PostRevision, rev1_id)
        rev2 = s.get(PostRevision, rev2_id)
        records = s.scalar(
            select(func.count()).select_from(ModerationRecord).where(
                ModerationRecord.target_id == post["id"]
            )
        )
        assert saved_post.latest_revision_id == rev2_id
        assert rev2.status == "Pending"
        if isinstance(approve_res, DomainError):
            # Author edit committed first -> rev1 superseded and approval rejected with 409.
            assert approve_res.code == "STALE_REVISION"
            assert approve_res.status == 409
            assert rev1.status == "Superseded"
            assert saved_post.public_revision_id is None
            assert records == 0
        else:
            # Admin approval committed first -> rev1 stays public while rev2 awaits review.
            assert rev1.status == "Approved"
            assert saved_post.public_revision_id == rev1_id
            assert records == 1


def test_mysql_concurrent_post_removal_vs_comment_approve_deadlock_free(
    db_session_factory, client, make_user, admin_headers
):
    comp = competition(client, admin_headers)
    _, author = make_user(complete=True)
    _, commenter = make_user()
    _, admin_b = make_user(role="Admin")
    post = client.post(
        f"/api/v1/competitions/{comp['id']}/posts",
        headers=author,
        json={"text": "Parent post for removal race"},
    ).json()
    approve(client, admin_headers, post["revisionId"])
    comment = client.post(
        f"/api/v1/posts/{post['id']}/comments",
        headers=commenter,
        json={"text": "Pending comment racing parent removal"},
    ).json()

    def remove_post():
        with db_session_factory() as s:
            return moderation_service.decide(
                s,
                raw(admin_headers),
                post["revisionId"],
                Decision(action="Remove", reason="Policy removal"),
            )

    def approve_comment():
        with db_session_factory() as s:
            return moderation_service.decide(
                s, raw(admin_b), comment["revisionId"], Decision(action="Approve")
            )

    remove_res, comment_res = race([remove_post, approve_comment])
    assert isinstance(remove_res, dict)
    assert remove_res["action"] == "Remove"
    assert isinstance(comment_res, dict) or (
        isinstance(comment_res, DomainError) and comment_res.status == 404
    )

    with db_session_factory() as s:
        saved_post = s.get(Post, post["id"])
        assert saved_post.removed is True
        # Queue count must exclude pending or orphaned comments under a removed parent post.
        assert moderation_service.pending_count(s) == 0
    assert client.get(f"/api/v1/posts/{post['id']}").status_code == 404
    assert client.get(f"/api/v1/posts/{post['id']}/comments").status_code == 404


def test_mysql_concurrent_post_interactions_idempotent_and_accurate(
    db_session_factory, client, make_user, admin_headers
):
    comp = competition(client, admin_headers)
    _, author = make_user(complete=True)
    post = client.post(
        f"/api/v1/competitions/{comp['id']}/posts",
        headers=author,
        json={
            "text": "Post with image and concurrent interactions",
            "images": [{"dataBase64": base64.b64encode(png()).decode()}],
        },
    ).json()
    approve(client, admin_headers, post["revisionId"])

    # 1. Same student submits 4 concurrent Like requests -> idempotent, zero PK conflicts.
    _, repeater = make_user()

    def repeat_like():
        with db_session_factory() as s:
            return content_service.interact(s, raw(repeater), post["id"], "Like", True)

    same_user_results = race([repeat_like for _ in range(4)])
    assert all(r == {"kind": "Like", "active": True} for r in same_user_results)

    # 2. Five additional distinct students concurrently Like and Favorite the same post.
    voters = [make_user()[1] for _ in range(5)]

    def vote(headers, kind):
        with db_session_factory() as s:
            return content_service.interact(s, raw(headers), post["id"], kind, True)

    multi_results = race(
        [lambda h=h: vote(h, "Like") for h in voters]
        + [lambda h=h: vote(h, "Favorite") for h in voters]
    )
    assert all(isinstance(r, dict) and r["active"] is True for r in multi_results)

    detail = client.get(f"/api/v1/posts/{post['id']}").json()
    assert detail["likes"] == 6
    assert detail["favorites"] == 5


def test_mysql_concurrent_course_edit_collision_rolls_back(
    db_session_factory, client, student_headers, timetable
):
    created = client.post(
        "/api/v1/planner/items",
        headers=student_headers,
        json={
            "kind": "Course",
            "title": "Operating Systems",
            "startWeek": 1,
            "weekday": 1,
            "startPeriod": 1,
            "endPeriod": 2,
            "occurrenceCount": 2,
        },
    )
    assert created.status_code == 201, created.text
    first_id, second_id = [item["id"] for item in created.json()["items"]]

    # Both courses concurrently move onto Week 3 Monday periods 1-2.
    def move_to_week3(item_id, room):
        with db_session_factory() as s:
            return planner_service.update_item(
                s, raw(student_headers), item_id, ItemPatch(startWeek=3, room=room)
            )

    results = race([
        lambda: move_to_week3(first_id, "Room A301"),
        lambda: move_to_week3(second_id, "Room B302"),
    ])
    wins = [r for r in results if not isinstance(r, DomainError)]
    errors = [r for r in results if isinstance(r, DomainError)]
    assert len(wins) == 1
    assert len(errors) == 1
    assert errors[0].code == "PLANNER_DUPLICATE_COURSE"
    assert errors[0].status == 409

    # Exactly one item moved to 2026-09-21; the losing item rolled back cleanly.
    with db_session_factory() as s:
        rows = list(s.scalars(select(PlannerItem).where(PlannerItem.id.in_([first_id, second_id]))))
        dates = sorted(row.date.isoformat() for row in rows)
        assert "2026-09-21" in dates
        assert len(set(dates)) == 2


def test_mysql_notification_concurrent_read_and_privacy_isolation(
    db_session_factory, client, make_user, admin_headers
):
    comp = competition(client, admin_headers)
    author_id, author = make_user(complete=True)
    _, stranger = make_user()
    post = client.post(
        f"/api/v1/competitions/{comp['id']}/posts",
        headers=author,
        json={"text": "Post triggering notification"},
    ).json()
    approve(client, admin_headers, post["revisionId"])

    inbox = client.get("/api/v1/notifications", headers=author).json()
    assert inbox["unreadCount"] == 1
    note_id = inbox["items"][0]["id"]

    def mark_read(headers):
        with db_session_factory() as s:
            return notification_service.detail(s, raw(headers), note_id, read=True)

    r1, r2, r_stranger = race([
        lambda: mark_read(author),
        lambda: mark_read(author),
        lambda: mark_read(stranger),
    ])
    assert isinstance(r1, dict) and r1["isRead"] is True
    assert isinstance(r2, dict) and r2["isRead"] is True
    assert isinstance(r_stranger, DomainError) and r_stranger.status == 404

    after = client.get("/api/v1/notifications", headers=author).json()
    assert after["unreadCount"] == 0
    assert after["items"][0]["isRead"] is True
    with db_session_factory() as s:
        assert s.get(Notification, note_id).recipient_id == author_id


def test_mysql_schema_engine_charset_and_check_constraints(
    db_session_factory, make_user, client, admin_headers
):
    expected_tables = {
        "users",
        "competitions",
        "teams",
        "applications",
        "memberships",
        "posts",
        "post_revisions",
        "comments",
        "comment_revisions",
        "post_interactions",
        "moderation_records",
        "notifications",
        "planner_items",
        "planner_recurrences",
    }
    with db_session_factory() as s:
        rows = s.execute(
            text(
                "SELECT TABLE_NAME, ENGINE, TABLE_COLLATION "
                "FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()"
            )
        ).all()
        by_name = {name: (engine, collation) for name, engine, collation in rows}
        for table in expected_tables:
            assert table in by_name, f"Missing table {table}"
            engine, collation = by_name[table]
            assert engine == "InnoDB", f"{table} uses {engine}"
            assert collation and collation.startswith("utf8mb4"), f"{table} uses {collation}"

    uid, headers = make_user(complete=True)
    comp = competition(client, admin_headers)
    post = client.post(
        f"/api/v1/competitions/{comp['id']}/posts",
        headers=headers,
        json={"text": "Constraint probe post"},
    ).json()

    # MySQL 8.4 CHECK constraint rejects inverted planner times at the storage layer.
    with db_session_factory() as s:
        with pytest.raises((IntegrityError, OperationalError)), s.begin():
            s.add(
                PlannerItem(
                    id=str(uuid4()),
                    owner_id=uid,
                    kind="TimedPlan",
                    title="Invalid time order",
                    date=date(2026, 11, 25),
                    start_time=time(10, 0),
                    end_time=time(9, 0),
                )
            )
            s.flush()

    # MySQL 8.4 CHECK constraint rejects unknown post interaction kinds.
    with db_session_factory() as s:
        with pytest.raises((IntegrityError, OperationalError)), s.begin():
            s.add(PostInteraction(actor_id=uid, post_id=post["id"], kind="Bookmark"))
            s.flush()
