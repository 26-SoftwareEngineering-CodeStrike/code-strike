from datetime import datetime
from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, ForeignKeyConstraint, JSON, LargeBinary, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.mysql import MEDIUMBLOB
from app.db.base import Base
from app.modules.competitions.models import uid, now


class Post(Base):
    __tablename__ = 'posts'
    __table_args__ = (UniqueConstraint('id', 'competition_id', name='uq_post_competition'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    competition_id: Mapped[str] = mapped_column(ForeignKey('competitions.id'), index=True)
    author_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    latest_revision_id: Mapped[str | None] = mapped_column(String(36))
    public_revision_id: Mapped[str | None] = mapped_column(String(36))
    deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    removed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class PostRevision(Base):
    __tablename__ = 'post_revisions'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    post_id: Mapped[str] = mapped_column(ForeignKey('posts.id'), index=True)
    text: Mapped[str] = mapped_column(Text)
    links: Mapped[list] = mapped_column(JSON, default=list)
    image_ids: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(16), default='Pending', index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Comment(Base):
    __tablename__ = 'comments'
    __table_args__ = (
        ForeignKeyConstraint(['post_id', 'competition_id'], ['posts.id', 'posts.competition_id']),
        UniqueConstraint('id', 'post_id', name='uq_comment_post'),
        ForeignKeyConstraint(['parent_id', 'post_id'], ['comments.id', 'comments.post_id']),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    competition_id: Mapped[str] = mapped_column(ForeignKey('competitions.id'), index=True)
    post_id: Mapped[str] = mapped_column(String(36), index=True)
    parent_id: Mapped[str | None] = mapped_column(String(36))
    author_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    latest_revision_id: Mapped[str | None] = mapped_column(String(36))
    public_revision_id: Mapped[str | None] = mapped_column(String(36))
    deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    removed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class CommentRevision(Base):
    __tablename__ = 'comment_revisions'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    comment_id: Mapped[str] = mapped_column(ForeignKey('comments.id'), index=True)
    text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default='Pending', index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class ContentImage(Base):
    __tablename__ = 'content_images'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    # Each upload belongs to exactly one immutable revision.
    revision_id: Mapped[str] = mapped_column(ForeignKey('post_revisions.id'), index=True)
    media_type: Mapped[str] = mapped_column(String(20))
    data: Mapped[bytes] = mapped_column(LargeBinary().with_variant(MEDIUMBLOB(), 'mysql'))


class PostInteraction(Base):
    __tablename__ = 'post_interactions'
    __table_args__ = (CheckConstraint("kind IN ('Like','Favorite')", name='ck_post_interaction_kind'),)
    actor_id: Mapped[str] = mapped_column(ForeignKey('users.id'), primary_key=True)
    post_id: Mapped[str] = mapped_column(ForeignKey('posts.id'), primary_key=True)
    kind: Mapped[str] = mapped_column(String(10), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

