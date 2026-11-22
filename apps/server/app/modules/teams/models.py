from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import (CheckConstraint, Computed, DateTime, ForeignKey, ForeignKeyConstraint,
                        Integer, JSON, String, Text, UniqueConstraint)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def uid() -> str:
    return str(uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Team(Base):
    __tablename__ = "teams"
    __table_args__ = (
        UniqueConstraint("id", "competition_id", name="uq_team_competition"),
        CheckConstraint("capacity >= 1", name="ck_team_capacity"),
        CheckConstraint("lifecycle IN ('Active','Dissolved')", name="ck_team_lifecycle"),
        CheckConstraint("recruitment_switch IN ('Open','Closed')", name="ck_team_switch"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"},
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    competition_id: Mapped[str] = mapped_column(ForeignKey("competitions.id"), index=True)
    captain_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(150))
    summary: Mapped[str] = mapped_column(Text)
    capacity: Mapped[int] = mapped_column(Integer)
    lifecycle: Mapped[str] = mapped_column(String(16), default="Active")
    publication: Mapped[str] = mapped_column(String(16), default="Private")
    recruitment_switch: Mapped[str] = mapped_column(String(10), default="Open")
    latest_revision_id: Mapped[str | None] = mapped_column(String(36))
    approved_revision_id: Mapped[str | None] = mapped_column(String(36))
    recruitment_removed: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class TeamSkill(Base):
    __tablename__ = "team_skills"
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"), primary_key=True)
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id"), primary_key=True)


class Membership(Base):
    """Append-only membership episodes; generated guard reserves only current relationships."""
    __tablename__ = "memberships"
    __table_args__ = (
        ForeignKeyConstraint(["team_id", "competition_id"], ["teams.id", "teams.competition_id"]),
        UniqueConstraint("student_id", "competition_id", "active_guard", name="uq_current_membership"),
        CheckConstraint("status IN ('Active','Ended')", name="ck_membership_status"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"},
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    team_id: Mapped[str] = mapped_column(String(36), index=True)
    competition_id: Mapped[str] = mapped_column(String(36), index=True)
    status: Mapped[str] = mapped_column(String(16), default="Active")
    active_guard: Mapped[int | None] = mapped_column(Integer, Computed("CASE WHEN status = 'Active' THEN 1 ELSE NULL END", persisted=True))
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime)
    end_reason: Mapped[str | None] = mapped_column(String(100))


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        ForeignKeyConstraint(["team_id", "competition_id"], ["teams.id", "teams.competition_id"]),
        UniqueConstraint("applicant_id", "team_id", "pending_guard", name="uq_pending_application"),
        CheckConstraint("status IN ('Pending','Approved','Rejected','Withdrawn','Invalidated')", name="ck_application_status"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"},
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    applicant_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    team_id: Mapped[str] = mapped_column(String(36), index=True)
    competition_id: Mapped[str] = mapped_column(String(36), index=True)
    status: Mapped[str] = mapped_column(String(16), default="Pending", index=True)
    pending_guard: Mapped[int | None] = mapped_column(Integer, Computed("CASE WHEN status = 'Pending' THEN 1 ELSE NULL END", persisted=True))
    reason: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime)


class RecruitmentRevision(Base):
    __tablename__ = "recruitment_revisions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"), index=True)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    payload: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(16), default="Pending", index=True)
    reviewer_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime)
