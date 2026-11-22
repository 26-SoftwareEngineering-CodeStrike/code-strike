"""All database access, including authentication and reads, is transactional."""
from datetime import date, time, timedelta
from hashlib import sha256
import json

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import DomainError
from app.core.security import require_actor
from app.modules.auth.models import User
from app.modules.planner.models import PlannerItem, PlannerRecurrence
from app.modules.planner.schemas import (
    CourseCreate, CreateResult, ItemCreate, ItemOut, ItemPage, ItemPatch,
    SkippedOccurrence, TimedPlanCreate, TodoCreate,
)


def _actor(session: Session, token: str, lock: bool = False):
    actor = require_actor(session, token, role="Student")
    if lock:
        # All planner writes lock the owner first, then an occurrence. A locking
        # duplicate read sees writes committed while waiting under MySQL RR.
        session.execute(select(User).where(User.id == actor.id).with_for_update())
    return actor


def _course_values(data: CourseCreate) -> dict:
    try:
        settings = get_settings()
        if not settings.semester_start_date or not settings.period_times:
            raise ValueError("missing semester/timetable")
        semester = date.fromisoformat(settings.semester_start_date)
        periods = {}
        for key, pair in settings.period_times.items():
            if len(pair) != 2:
                raise ValueError("invalid period pair")
            start, end = map(time.fromisoformat, pair)
            if start.tzinfo or end.tzinfo or start.microsecond or end.microsecond or start >= end:
                raise ValueError("invalid period times")
            periods[int(key)] = (start, end)
    except (ValueError, TypeError) as exc:
        raise DomainError("PLANNER_CONFIG_MISSING",
                          "Configure a valid SEMESTER_START_DATE and PERIOD_TIMES timetable.", 503) from exc
    if sum(data.start_period <= p <= data.end_period for p in periods) != data.end_period - data.start_period + 1:
        raise DomainError("PLANNER_PERIOD_UNKNOWN", "Selected periods are not configured.", 422)
    start = periods[data.start_period][0]
    end = periods[data.end_period][1]
    if start >= end:
        raise DomainError("PLANNER_CONFIG_MISSING", "Configured period times are not ordered.", 503)
    # Week 1 is the Monday-based calendar week containing semester_start_date.
    monday = semester - timedelta(days=semester.weekday())
    try:
        actual_date = monday + timedelta(weeks=data.start_week - 1, days=data.weekday - 1)
    except OverflowError as exc:
        raise DomainError("PLANNER_DATE_RANGE", "Course date exceeds the supported calendar.", 422) from exc
    return dict(date=actual_date, start_time=start, end_time=end)


def _key(owner_id: str, values: dict) -> str | None:
    if values["kind"] != "Course":
        return None
    parts = [owner_id, values["title"], values["date"].isoformat(),
             values["start_time"].isoformat(), values["end_time"].isoformat()]
    return sha256(json.dumps(parts, ensure_ascii=False).encode("utf-8")).hexdigest()


def _duplicate(session: Session, key: str | None, except_id: str | None = None) -> bool:
    if key is None:
        return False
    stmt = select(PlannerItem.id).where(PlannerItem.course_key == key)
    if except_id:
        stmt = stmt.where(PlannerItem.id != except_id)
    return session.scalar(stmt.with_for_update()) is not None


def create_item(session: Session, token: str, data: ItemCreate) -> CreateResult:
    with session.begin():
        actor = _actor(session, token, lock=True)
        values = data.model_dump(exclude={"occurrence_count"})
        if isinstance(data, CourseCreate):
            values.update(_course_values(data))
        # Validate the entire finite batch before persisting any occurrence.
        try:
            values["date"] + timedelta(weeks=data.occurrence_count - 1)
            if values.get("deadline"):
                values["deadline"] + timedelta(weeks=data.occurrence_count - 1)
        except OverflowError as exc:
            raise DomainError("PLANNER_DATE_RANGE", "Recurrence exceeds the supported calendar.", 422) from exc
        batch = None
        items, skipped = [], []
        for offset in range(data.occurrence_count):
            instance = {**values, "date": values["date"] + timedelta(weeks=offset)}
            if instance.get("start_week") is not None:
                instance["start_week"] += offset
            if instance.get("deadline") is not None:
                instance["deadline"] += timedelta(weeks=offset)
            key = _key(actor.id, instance)
            if _duplicate(session, key):
                skipped.append(SkippedOccurrence(date=instance["date"]))
                continue
            if batch is None and data.occurrence_count > 1:
                batch = PlannerRecurrence(owner_id=actor.id, start_date=values["date"],
                                          occurrence_count=data.occurrence_count)
                session.add(batch)
                session.flush()
            item = PlannerItem(**instance, owner_id=actor.id, course_key=key,
                               recurrence_id=batch.id if batch else None)
            session.add(item)
            session.flush()
            items.append(ItemOut.model_validate(item))
        return CreateResult(items=items, skipped=skipped)


def _owned(session: Session, owner_id: str, item_id: str, lock: bool = False) -> PlannerItem:
    stmt = select(PlannerItem).where(PlannerItem.id == item_id, PlannerItem.owner_id == owner_id)
    item = session.scalar(stmt.with_for_update() if lock else stmt)
    if item is None:
        raise DomainError("PLANNER_NOT_FOUND", "Planner item not found.", 404)
    return item


def get_item(session: Session, token: str, item_id: str) -> ItemOut:
    with session.begin():
        actor = _actor(session, token)
        return ItemOut.model_validate(_owned(session, actor.id, item_id))


def update_item(session: Session, token: str, item_id: str, patch: ItemPatch) -> ItemOut:
    with session.begin():
        actor = _actor(session, token, lock=True)
        item = _owned(session, actor.id, item_id, lock=True)
        changes = patch.model_dump(exclude_unset=True)
        schema = {"Course": CourseCreate, "TimedPlan": TimedPlanCreate, "Todo": TodoCreate}[item.kind]
        allowed = set(schema.model_fields) - {"kind", "occurrence_count"}
        if item.kind == "Todo":
            allowed.add("completed")
        if changes.keys() - allowed:
            raise DomainError("PLANNER_INVALID_FIELDS", "Fields do not apply to this item type.", 422)
        values = {name: getattr(item, name) for name in schema.model_fields if name != "occurrence_count"}
        values.update({k: v for k, v in changes.items() if k != "completed"})
        try:
            validated = schema.model_validate(values)
        except ValidationError as exc:
            raise DomainError("PLANNER_INVALID_FIELDS", "Invalid planner fields or time range.", 422) from exc
        updated = validated.model_dump(exclude={"occurrence_count"})
        if item.kind == "Course":
            if changes.keys() & {"start_week", "weekday", "start_period", "end_period"}:
                updated.update(_course_values(validated))
            else:
                updated.update(date=item.date, start_time=item.start_time, end_time=item.end_time)
        key = _key(actor.id, updated)
        if _duplicate(session, key, item.id):
            raise DomainError("PLANNER_DUPLICATE_COURSE", "An identical course occurrence already exists.")
        for name, value in updated.items():
            setattr(item, name, value)
        if "completed" in changes:
            item.completed = changes["completed"]
        item.course_key = key
        session.flush()
        return ItemOut.model_validate(item)


def delete_item(session: Session, token: str, item_id: str) -> None:
    with session.begin():
        actor = _actor(session, token, lock=True)
        session.delete(_owned(session, actor.id, item_id, lock=True))


def list_items(session: Session, token: str, selected_date: date, view: str,
               page: int, page_size: int) -> ItemPage:
    with session.begin():
        actor = _actor(session, token)
        start = selected_date
        if view == "week":
            start -= timedelta(days=start.weekday())
        end = min(start.toordinal() + (6 if view == "week" else 0), date.max.toordinal())
        end = date.fromordinal(end)
        predicate = (PlannerItem.owner_id == actor.id, PlannerItem.date >= start, PlannerItem.date <= end)
        total = session.scalar(select(func.count()).select_from(PlannerItem).where(*predicate))
        rows = session.scalars(select(PlannerItem).where(*predicate)
                               .order_by(PlannerItem.date, PlannerItem.start_time, PlannerItem.id)
                               .offset((page - 1) * page_size).limit(page_size)).all()
        return ItemPage(items=[ItemOut.model_validate(row) for row in rows], total=total,
                        page=page, page_size=page_size, start_date=start, end_date=end)
