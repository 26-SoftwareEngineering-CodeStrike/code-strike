from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Profile(Base):
    __tablename__ = 'profiles'
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    name: Mapped[str | None] = mapped_column(String(100))
    college: Mapped[str | None] = mapped_column(String(200))
    major: Mapped[str | None] = mapped_column(String(200))
    academic_year: Mapped[str | None] = mapped_column(String(40))
    sex: Mapped[str | None] = mapped_column(String(30))
    brief_cv: Mapped[str | None] = mapped_column(Text)
    wechat_id: Mapped[str | None] = mapped_column(String(100))
    qq_id: Mapped[str | None] = mapped_column(String(100))
    mbti: Mapped[str | None] = mapped_column(String(4))
    hobbies: Mapped[str | None] = mapped_column(Text)


class ProfileSkill(Base):
    __tablename__ = 'profile_skills'
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey('profiles.user_id', ondelete='CASCADE'), primary_key=True)
    skill_id: Mapped[str] = mapped_column(String(36), ForeignKey('skills.id', ondelete='RESTRICT'), primary_key=True)
