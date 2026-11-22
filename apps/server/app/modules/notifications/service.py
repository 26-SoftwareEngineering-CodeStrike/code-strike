from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.core.exceptions import DomainError
from app.core.security import require_actor
from .models import Notification


def notify(session: Session, recipient_id: str, event: str, target_type: str,
           target_id: str, message: str) -> None:
    """Called inside the originating business transaction; never embeds private profiles."""
    session.add(Notification(recipient_id=recipient_id, event=event, target_type=target_type,
                             target_id=target_id, message=message))


def present(n: Notification) -> dict:
    return {"id": n.id, "event": n.event, "message": n.message, "isRead": n.is_read,
            "target": {"type": n.target_type, "id": n.target_id}, "createdAt": n.created_at}


def inbox(session: Session, token: str, offset: int, limit: int) -> dict:
    with session.begin():
        actor = require_actor(session, token)
        query = select(Notification).where(Notification.recipient_id == actor.id)
        rows = session.scalars(query.order_by(Notification.created_at.desc(), Notification.id).offset(offset).limit(limit))
        unread = session.scalar(select(func.count()).select_from(Notification).where(
            Notification.recipient_id == actor.id, Notification.is_read.is_(False)))
        return {"items": [present(n) for n in rows], "unreadCount": unread}


def detail(session: Session, token: str, notification_id: str, read: bool | None = None) -> dict:
    with session.begin():
        actor = require_actor(session, token)
        n = session.scalar(select(Notification).where(Notification.id == notification_id,
                            Notification.recipient_id == actor.id).with_for_update())
        if n is None:
            raise DomainError("NOT_FOUND", "Notification not found.", 404)
        if read is not None:
            n.is_read = read
        # Target IDs convey no permission. Target endpoints always reauthorize current access.
        return present(n)
