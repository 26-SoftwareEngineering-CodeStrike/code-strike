from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


def uid() -> str:
    return str(uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Competition(Base):
    __tablename__ = 'competitions'
    __table_args__ = (CheckConstraint('max_team_size >= 1', name='ck_competition_team_size'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    title: Mapped[str] = mapped_column(String(200), index=True)
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(100))
    registration_deadline: Mapped[datetime] = mapped_column(DateTime)
    eligibility_rules: Mapped[str] = mapped_column(Text)
    max_team_size: Mapped[int]
    official_source_url: Mapped[str] = mapped_column(String(2048))
    cover_image: Mapped[str | None] = mapped_column(String(2048))
    published: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Community(Base):
    __tablename__ = 'communities'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    competition_id: Mapped[str] = mapped_column(ForeignKey('competitions.id'), unique=True)


class CompetitionSubmission(Base):
    __tablename__ = 'competition_submissions'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    author_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    competition_id: Mapped[str | None] = mapped_column(ForeignKey('competitions.id'), unique=True)
    latest_revision_id: Mapped[str | None] = mapped_column(String(36))
    deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class CompetitionSubmissionRevision(Base):
    __tablename__ = 'competition_submission_revisions'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    submission_id: Mapped[str] = mapped_column(ForeignKey('competition_submissions.id'), index=True)
    payload: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(16), default='Pending', index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

