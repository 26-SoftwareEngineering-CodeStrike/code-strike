import base64
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.core.exceptions import DomainError
from app.core.security import require_actor
from app.modules.auth.models import User
from app.modules.competitions.service import get_competition
from app.modules.competitions.models import Competition
from app.modules.profiles.service import require_complete_profile
from .models import Comment, CommentRevision, ContentImage, Post, PostInteraction, PostRevision
from .images import validate_image


def post_record(session, post_id, *, lock=False, public=True):
    stmt = select(Post).where(Post.id == post_id)
    p = session.scalar(stmt.with_for_update().execution_options(populate_existing=True) if lock else stmt)
    if p is None or p.deleted or p.removed or (public and not p.public_revision_id):
        raise DomainError('NOT_FOUND', 'Post not found.', 404)
    get_competition(session, p.competition_id)
    return p


def post_view(session, p, revision=None):
    r = revision or session.get(PostRevision, p.public_revision_id)
    author = session.get(User, p.author_id)
    counts = dict(session.execute(select(PostInteraction.kind, func.count()).where(
        PostInteraction.post_id == p.id).group_by(PostInteraction.kind)).all())
    return dict(id=p.id, competitionId=p.competition_id, username=author.username,
                revisionId=r.id, status=r.status, text=r.text, links=r.links, imageIds=r.image_ids,
                likes=counts.get('Like', 0), favorites=counts.get('Favorite', 0), createdAt=p.created_at)


def comment_view(session, c, revision=None):
    r = revision or session.get(CommentRevision, c.public_revision_id)
    return dict(id=c.id, postId=c.post_id, competitionId=c.competition_id, parentId=c.parent_id,
                username=session.get(User, c.author_id).username, revisionId=r.id, text=r.text,
                status=r.status, createdAt=c.created_at)


def create_post(session: Session, token, competition_id, body, post_id=None):
    # Decode/validate file data before opening the transaction.
    images = [(base64.b64decode(i.dataBase64), None) for i in body.images]
    images = [(data, validate_image(data)) for data, _ in images]
    with session.begin():
        actor = require_actor(session, token, 'Student')
        if post_id:
            p = post_record(session, post_id, lock=True, public=False)
            if p.author_id != actor.id:
                raise DomainError('FORBIDDEN', 'Only the author can edit this post.', 403)
        else:
            require_complete_profile(session, actor.id)
            get_competition(session, competition_id)
            p = Post(competition_id=competition_id, author_id=actor.id)
            session.add(p)
            session.flush()
        if p.latest_revision_id:
            old = session.get(PostRevision, p.latest_revision_id)
            if old.status == 'Pending':
                old.status = 'Superseded'
        r = PostRevision(post_id=p.id, text=body.text, links=[str(x) for x in body.links], image_ids=[])
        session.add(r)
        session.flush()
        ids = []
        for data, media_type in images:
            image = ContentImage(owner_id=actor.id, revision_id=r.id, media_type=media_type, data=data)
            session.add(image)
            session.flush()
            ids.append(image.id)
        r.image_ids = ids
        p.latest_revision_id = r.id
        return post_view(session, p, r)


def posts(session, competition_id, offset, limit):
    with session.begin():
        get_competition(session, competition_id)
        rows = session.scalars(select(Post).where(Post.competition_id == competition_id,
            Post.deleted.is_(False), Post.removed.is_(False), Post.public_revision_id.is_not(None))
            .order_by(Post.created_at.desc(), Post.id).offset(offset).limit(limit))
        return [post_view(session, p) for p in rows]


def detail(session, post_id):
    with session.begin():
        return post_view(session, post_record(session, post_id))


def edit_comment(session, token, body, post_id=None, comment_id=None):
    with session.begin():
        actor = require_actor(session, token, 'Student')
        if comment_id:
            c = session.get(Comment, comment_id)
            if not c:
                raise DomainError('NOT_FOUND', 'Comment not found.', 404)
            post_id = c.post_id
        p = post_record(session, post_id, lock=True)
        if comment_id:
            c = session.scalar(select(Comment).where(Comment.id == comment_id).with_for_update()
                               .execution_options(populate_existing=True))
            if c.author_id != actor.id:
                raise DomainError('FORBIDDEN', 'Only the author can edit this comment.', 403)
            if c.deleted or c.removed:
                raise DomainError('NOT_FOUND', 'Comment not found.', 404)
            old = session.get(CommentRevision, c.latest_revision_id)
            if old.status == 'Pending':
                old.status = 'Superseded'
        else:
            if body.parentId:
                parent = session.get(Comment, body.parentId)
                if not parent or parent.post_id != p.id or parent.deleted or parent.removed or not parent.public_revision_id:
                    raise DomainError('INVALID_PARENT', 'Reply must belong to a published comment on this post.', 422)
            c = Comment(post_id=p.id, competition_id=p.competition_id, author_id=actor.id, parent_id=body.parentId)
            session.add(c)
            session.flush()
        r = CommentRevision(comment_id=c.id, text=body.text)
        session.add(r)
        session.flush()
        c.latest_revision_id = r.id
        return comment_view(session, c, r)


def comments(session, post_id, offset, limit):
    with session.begin():
        post_record(session, post_id)
        return [comment_view(session, c) for c in session.scalars(select(Comment).where(Comment.post_id == post_id,
                Comment.deleted.is_(False), Comment.removed.is_(False), Comment.public_revision_id.is_not(None))
                .order_by(Comment.created_at, Comment.id).offset(offset).limit(limit))]


def delete_content(session, token, kind, object_id):
    with session.begin():
        actor = require_actor(session, token, 'Student')
        cls = Post if kind == 'Post' else Comment
        if kind == 'Comment':
            c = session.get(Comment, object_id)
            if not c:
                raise DomainError('NOT_FOUND', 'Content not found.', 404)
            session.scalar(select(Post).where(Post.id == c.post_id).with_for_update())
        obj = session.scalar(select(cls).where(cls.id == object_id).with_for_update()
                             .execution_options(populate_existing=True))
        if not obj:
            raise DomainError('NOT_FOUND', 'Content not found.', 404)
        if obj.author_id != actor.id:
            raise DomainError('FORBIDDEN', 'Only the author may delete content.', 403)
        obj.deleted = True


def interact(session, token, post_id, kind, enabled):
    with session.begin():
        actor = require_actor(session, token, 'Student')
        post_record(session, post_id, lock=True)
        item = session.get(PostInteraction, (actor.id, post_id, kind))
        if enabled and not item:
            session.add(PostInteraction(actor_id=actor.id, post_id=post_id, kind=kind))
        elif not enabled and item:
            session.delete(item)
        return {'kind': kind, 'active': enabled}


def my_posts(session, token, offset, limit, favorites=False):
    with session.begin():
        actor = require_actor(session, token, 'Student')
        query = select(Post)
        if favorites:
            query = query.join(PostInteraction, PostInteraction.post_id == Post.id).where(
                PostInteraction.actor_id == actor.id, PostInteraction.kind == 'Favorite', Post.public_revision_id.is_not(None))
            query = query.join(Competition, Competition.id == Post.competition_id).where(
                Competition.published.is_(True), Competition.deleted.is_(False))
        else:
            query = query.where(Post.author_id == actor.id)
        query = query.where(Post.deleted.is_(False), Post.removed.is_(False)).order_by(Post.created_at.desc(), Post.id).offset(offset).limit(limit)
        return [post_view(session, p, None if favorites else session.get(PostRevision, p.latest_revision_id)) for p in session.scalars(query)]


def image_data(session, image_id, token=None):
    with session.begin():
        image = session.get(ContentImage, image_id)
        if not image:
            raise DomainError('NOT_FOUND', 'Image not found.', 404)
        r = session.get(PostRevision, image.revision_id)
        p = session.get(Post, r.post_id)
        actor = require_actor(session, token) if token else None
        public = p.public_revision_id == r.id and not p.deleted and not p.removed
        if not public and (not actor or actor.id != image.owner_id and actor.role != 'Admin'):
            raise DomainError('NOT_FOUND', 'Image not found.', 404)
        if public:
            get_competition(session, p.competition_id)
        return image.data, image.media_type
