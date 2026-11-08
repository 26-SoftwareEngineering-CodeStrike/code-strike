"""Planner acceptance tests; timetable values below are demonstration data only."""
import pytest

from app.core.config import get_settings


@pytest.fixture
def timetable(monkeypatch):
    monkeypatch.setenv("SEMESTER_START_DATE", "2026-09-07")
    monkeypatch.setenv("PERIOD_TIMES", '{"1":["08:00","08:45"],"2":["08:55","09:40"]}')
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


COURSE = dict(kind="Course", title="Algorithms", startWeek=1, weekday=1,
              startPeriod=1, endPeriod=2, occurrenceCount=3)
TODO = dict(kind="Todo", title="Read", date="2026-09-07", occurrenceCount=3)


def create(client, headers, body):
    response = client.post("/api/v1/planner/items", headers=headers, json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_courses_finite_dates_partial_dedup(client, student_headers, timetable):
    first = create(client, student_headers, COURSE)
    assert [x["date"] for x in first["items"]] == ["2026-09-07", "2026-09-14", "2026-09-21"]
    assert first["items"][0]["startTime"] == "08:00:00"
    assert first["items"][0]["endTime"] == "09:40:00"
    again = create(client, student_headers, {**COURSE, "startWeek": 2})
    assert [x["date"] for x in again["items"]] == ["2026-09-28"]
    assert [x["date"] for x in again["skipped"]] == ["2026-09-14", "2026-09-21"]


def test_single_occurrence_mutations(client, student_headers):
    items = create(client, student_headers, TODO)["items"]
    first, second, third = [x["id"] for x in items]
    base = "/api/v1/planner/items/"
    assert client.patch(base + first, headers=student_headers, json={"completed": True}).status_code == 200
    assert client.patch(base + second, headers=student_headers, json={"title": "Changed"}).status_code == 200
    assert client.delete(base + third, headers=student_headers).status_code == 204
    assert client.get(base + first, headers=student_headers).json()["completed"] is True
    result = client.get(base + second, headers=student_headers).json()
    assert result["completed"] is False and result["title"] == "Changed"
    assert client.get(base + third, headers=student_headers).status_code == 404


def test_integrated_views_overlap_and_undated_deadline(client, student_headers, timetable):
    create(client, student_headers, {**COURSE, "occurrenceCount": 1})
    create(client, student_headers, {**TODO, "occurrenceCount": 1})
    plan = dict(kind="TimedPlan", title="Practice", date="2026-09-07",
                startTime="08:30", endTime="09:30")
    create(client, student_headers, plan)
    create(client, student_headers, plan)  # only courses are deduplicated
    for view in ("day", "week"):
        response = client.get(f"/api/v1/planner/{view}?date=2026-09-07&pageSize=2", headers=student_headers)
        assert response.status_code == 200, response.text
        assert response.json()["total"] == 4
        assert len(response.json()["items"]) == 2
    result = client.get("/api/v1/planner/day?date=2026-09-07", headers=student_headers).json()
    assert any(x["kind"] == "Todo" and x["deadline"] is None for x in result["items"])
    assert client.get("/api/v1/planner/day?date=2026-09-08", headers=student_headers).json()["total"] == 0


def test_private_to_owner_and_student_role(client, student_headers, other_headers, admin_headers):
    item = create(client, student_headers, TODO)["items"][0]
    url = "/api/v1/planner/items/" + item["id"]
    for headers, status in ((other_headers, 404), (admin_headers, 403)):
        assert client.get(url, headers=headers).status_code == status
        assert client.patch(url, headers=headers, json={"title": "Attack"}).status_code == status
        assert client.delete(url, headers=headers).status_code == status
    assert client.get("/api/v1/planner/day?date=2026-09-07", headers=other_headers).json()["total"] == 0
    assert client.get("/api/v1/planner/day?date=2026-09-07", headers=admin_headers).status_code == 403
    assert client.post("/api/v1/planner/items", headers=admin_headers, json=TODO).status_code == 403
    assert client.get(url).status_code == 401


@pytest.mark.parametrize("changes", [
    {"title": " "}, {"occurrenceCount": 0}, {"occurrenceCount": None},
    {"occurrenceCount": 1.5}, {"date": "bad"}, {"ownerId": "someone"},
])
def test_validation(client, student_headers, changes):
    assert client.post("/api/v1/planner/items", headers=student_headers,
                       json={**TODO, **changes}).status_code == 422


def test_missing_course_config(client, student_headers, monkeypatch):
    monkeypatch.delenv("SEMESTER_START_DATE", raising=False)
    monkeypatch.setenv("PERIOD_TIMES", "{}")
    get_settings.cache_clear()
    try:
        response = client.post("/api/v1/planner/items", headers=student_headers, json=COURSE)
        assert response.status_code == 503
        assert response.json()["code"] == "PLANNER_CONFIG_MISSING"
    finally:
        get_settings.cache_clear()


def test_course_edit_delete_only_selected_occurrence(client, student_headers, timetable):
    rows = create(client, student_headers, COURSE)["items"]
    base = "/api/v1/planner/items/"
    changed = client.patch(base + rows[1]["id"], headers=student_headers,
                           json={"weekday": 2, "room": "Lab"})
    assert changed.status_code == 200, changed.text
    assert changed.json()["date"] == "2026-09-15"
    assert client.get(base + rows[0]["id"], headers=student_headers).json()["date"] == "2026-09-07"
    assert client.delete(base + rows[1]["id"], headers=student_headers).status_code == 204
    assert client.get(base + rows[2]["id"], headers=student_headers).json()["date"] == "2026-09-21"


def test_course_conflicting_edit_rolls_back(client, student_headers, timetable):
    rows = create(client, student_headers, COURSE)["items"]
    url = "/api/v1/planner/items/" + rows[1]["id"]
    response = client.patch(url, headers=student_headers, json={"startWeek": 1, "room": "Changed"})
    assert response.status_code == 409
    actual = client.get(url, headers=student_headers).json()
    assert actual["date"] == "2026-09-14" and actual["room"] is None


def test_course_dedup_is_owner_scoped(client, student_headers, other_headers, timetable):
    assert len(create(client, student_headers, COURSE)["items"]) == 3
    assert len(create(client, other_headers, COURSE)["items"]) == 3
    duplicate = create(client, student_headers, COURSE)
    assert duplicate["items"] == [] and len(duplicate["skipped"]) == 3


def test_repeated_deadlines_and_nullable_edits(client, student_headers):
    rows = create(client, student_headers, {**TODO, "deadline": "2026-09-07T10:00:00+08:00"})["items"]
    assert rows[0]["deadline"] == "2026-09-07T02:00:00"
    assert rows[1]["deadline"] == "2026-09-14T02:00:00"
    response = client.patch("/api/v1/planner/items/" + rows[0]["id"], headers=student_headers,
                            json={"deadline": None, "description": "Notes"})
    assert response.status_code == 200
    assert response.json()["deadline"] is None


@pytest.mark.parametrize("patch", [{}, {"title": None}, {"completed": None},
                                  {"startTime": "08:00"}, {"occurrenceCount": 2}])
def test_invalid_patch(client, student_headers, patch):
    row = create(client, student_headers, TODO)["items"][0]
    response = client.patch("/api/v1/planner/items/" + row["id"], headers=student_headers, json=patch)
    assert response.status_code == 422


@pytest.mark.parametrize("start,end", [("10:00", "09:00"), ("09:00", "09:00"),
                                     ("08:00+08:00", "09:00+08:00")])
def test_invalid_plan_times(client, student_headers, start, end):
    response = client.post("/api/v1/planner/items", headers=student_headers, json={
        "kind": "TimedPlan", "title": "Bad", "date": "2026-09-07", "startTime": start, "endTime": end})
    assert response.status_code == 422


def test_course_database_unique_guard(client, student_headers, timetable, db_session_factory):
    from sqlalchemy import select
    from sqlalchemy.exc import IntegrityError
    from app.modules.planner.models import PlannerItem

    row = create(client, student_headers, COURSE)["items"][0]
    with db_session_factory() as session:
        with pytest.raises(IntegrityError), session.begin():
            original = session.scalar(select(PlannerItem).where(PlannerItem.id == row["id"]))
            clone = {column.name: getattr(original, column.name)
                     for column in PlannerItem.__table__.columns if column.name != "id"}
            session.add(PlannerItem(**clone))
            session.flush()


def test_mysql_concurrent_course_dedup(student_headers, timetable, db_session_factory):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from app.modules.planner.schemas import CourseCreate
    from app.modules.planner.service import create_item

    with db_session_factory() as session:
        if session.get_bind().dialect.name != "mysql":
            pytest.skip("Row-lock concurrency requires MySQL; SQLite is not proof.")
    barrier = Barrier(2)
    token = student_headers["Authorization"].split(" ", 1)[1]

    def create_batch():
        with db_session_factory() as session:
            barrier.wait(timeout=10)
            return create_item(session, token, CourseCreate.model_validate(COURSE))

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: create_batch(), range(2)))
    assert sorted(len(result.items) for result in results) == [0, 3]
    assert sorted(len(result.skipped) for result in results) == [0, 3]
