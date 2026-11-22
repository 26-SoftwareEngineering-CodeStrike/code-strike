"""Materialized occurrences: modifying a row never modifies its siblings."""
from datetime import date, datetime, time, timezone
from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class PlannerRecurrence(Base):
    __tablename__ = "planner_recurrences"
    __table_args__ = (
        CheckConstraint("occurrence_count > 0", name="ck_planner_recurrence_count"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"},
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    start_date: Mapped[date] = mapped_column(Date)
    occurrence_count: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class PlannerItem(Base):
    __tablename__ = "planner_items"
    __table_args__ = (
        Index("ix_planner_owner_date", "owner_id", "date"),
        CheckConstraint("kind IN ('Course', 'TimedPlan', 'Todo')", name="ck_planner_kind"),
        CheckConstraint("end_time IS NULL OR start_time < end_time", name="ck_planner_times"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"},
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    recurrence_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("planner_recurrences.id", ondelete="SET NULL"), index=True)
    kind: Mapped[str] = mapped_column(String(16))
    title: Mapped[str] = mapped_column(String(255))
    date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    start_week: Mapped[int | None] = mapped_column(Integer)
    weekday: Mapped[int | None] = mapped_column(Integer)
    start_period: Mapped[int | None] = mapped_column(Integer)
    end_period: Mapped[int | None] = mapped_column(Integer)
    room: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    deadline: Mapped[datetime | None] = mapped_column(DateTime)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    # SHA-256 includes owner/name/actual date/times; NULL for non-course rows.
    course_key: Mapped[str | None] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)
