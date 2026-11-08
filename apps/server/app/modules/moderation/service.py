from sqlalchemy import select
from app.core.exceptions import DomainError
from app.core.security import require_actor
from app.modules.competitions.models import CompetitionSubmission, CompetitionSubmissionRevision
from app.modules.competitions.schemas import CompetitionInput
from app.modules.competitions.service import create_record
from app.modules.content.models import Post, PostRevision, Comment, CommentRevision
from app.modules.content.service import post_view, comment_view, post_record
from app.modules.notifications.service import notify
from .models import ModerationRecord

KINDS = {'Post': (Post, PostRevision, 'post_id'), 'Comment': (Comment, CommentRevision, 'comment_id'),
         'Competition': (CompetitionSubmission, CompetitionSubmissionRevision, 'submission_id')}


def revision_data(session, kind, obj, rev):
    if kind == 'Competition':
        payload = rev.payload
    elif kind == 'Post':
        payload = post_view(session, obj, rev)
    else:
        payload = comment_view(session, obj, rev)
    return dict(id=rev.id, revisionId=rev.id, targetId=obj.id, kind=kind, status=rev.status, proposed=payload)


def locate(session, revision_id):
    for kind, (cls, rev_cls, fk) in KINDS.items():
        rev = session.get(rev_cls, revision_id)
        if rev:
            # Parent post first, to serialize comment moderation against post deletion.
            if kind == 'Comment':
                comment = session.get(cls, rev.comment_id)
                session.scalar(select(Post).where(Post.id == comment.post_id).with_for_update())
            obj = session.scalar(select(cls).where(cls.id == getattr(rev, fk)).with_for_update()
                                 .execution_options(populate_existing=True))
            session.refresh(rev)
            return kind, obj, rev
    raise DomainError('NOT_FOUND', 'Revision not found.', 404)


def listing(session, token, offset, limit, status='Pending'):
    with session.begin():
        require_actor(session, token, 'Admin')
        # Bounded per-type fetch, then stable combined pagination.
        candidates = []
        for kind, (cls, rev_cls, fk) in KINDS.items():
            query = select(rev_cls, cls).join(cls, cls.id == getattr(rev_cls, fk)).where(rev_cls.status == status)
            query = query.order_by(rev_cls.created_at, rev_cls.id).limit(offset+limit)
            for rev, obj in session.execute(query):
                candidates.append((rev.created_at, rev.id, revision_data(session, kind, obj, rev)))
        candidates.sort(key=lambda v: (v[0], v[1]))
        return [x[2] for x in candidates[offset:offset+limit]]


def detail(session, token, revision_id):
    with session.begin():
        require_actor(session, token, 'Admin')
        kind, obj, rev = locate(session, revision_id)
        result = revision_data(session, kind, obj, rev)
        if kind in ('Post', 'Comment') and obj.public_revision_id:
            revision = session.get(KINDS[kind][1], obj.public_revision_id)
            result['effective'] = revision_data(session, kind, obj, revision)['proposed']
        result['history'] = [dict(revisionId=r.id, status=r.status, createdAt=r.created_at)
            for r in session.scalars(select(KINDS[kind][1]).where(getattr(KINDS[kind][1], KINDS[kind][2]) == obj.id)
            .order_by(KINDS[kind][1].created_at).limit(100))]
        return result


def decide(session, token, revision_id, data):
    with session.begin():
        admin = require_actor(session, token, 'Admin')
        kind, obj, rev = locate(session, revision_id)
        if data.action == 'Remove':
            if kind == 'Competition':
                raise DomainError('INVALID_ACTION', 'Use competition maintenance to remove a competition.', 422)
            if obj.deleted or obj.removed:
                raise DomainError('REMOVED', 'Content is already removed.')
            obj.removed = True
        else:
            if obj.deleted or getattr(obj, 'removed', False) or obj.latest_revision_id != rev.id or rev.status != 'Pending':
                raise DomainError('STALE_REVISION', 'Cannot approve a stale, deleted or processed revision.')
            if kind == 'Comment':
                post_record(session, obj.post_id)
            if data.action == 'Approve':
                if kind == 'Competition':
                    if obj.competition_id:
                        raise DomainError('SUBMISSION_CLOSED', 'Submission is already published.')
                    comp = create_record(session, CompetitionInput.model_validate(rev.payload))
                    obj.competition_id = comp.id
                else:
                    obj.public_revision_id = rev.id
                rev.status = 'Approved'
            else:
                rev.status = 'Rejected'
        session.add(ModerationRecord(target_type=kind, target_id=obj.id, revision_id=rev.id,
                                    reviewer_id=admin.id, action=data.action, reason=data.reason))
        notify(session, obj.author_id, 'Moderation'+data.action, kind.lower(), obj.id,
               kind+' moderation: '+data.action.lower()+'.')
        return dict(revisionId=rev.id, status=rev.status, action=data.action)
