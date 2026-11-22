from fastapi import APIRouter, Depends, Query, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.security import bearer_token
from app.db.session import get_session
from . import service
from .schemas import PostInput, CommentInput, CommentEdit, InteractionKind
from .schemas import PostOut, CommentOut

router = APIRouter(tags=['community content'])
optional_bearer = HTTPBearer(auto_error=False)


@router.get('/competitions/{competition_id}/posts', response_model=list[PostOut])
def posts(competition_id: str, offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100), session: Session = Depends(get_session)):
    return service.posts(session, competition_id, offset, limit)


@router.post('/competitions/{competition_id}/posts', status_code=201, response_model=PostOut)
def create(competition_id: str, body: PostInput, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.create_post(session, token, competition_id, body)


@router.get('/posts/{post_id}', response_model=PostOut)
def detail(post_id: str, session: Session = Depends(get_session)):
    return service.detail(session, post_id)


@router.patch('/posts/{post_id}', response_model=PostOut)
def edit(post_id: str, body: PostInput, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.create_post(session, token, None, body, post_id)


@router.delete('/posts/{post_id}', status_code=204)
def delete_post(post_id: str, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    service.delete_content(session, token, 'Post', post_id)
    return Response(status_code=204)


@router.get('/posts/{post_id}/comments', response_model=list[CommentOut])
def comments(post_id: str, offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100), session: Session = Depends(get_session)):
    return service.comments(session, post_id, offset, limit)


@router.post('/posts/{post_id}/comments', status_code=201, response_model=CommentOut)
def comment(post_id: str, body: CommentInput, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.edit_comment(session, token, body, post_id=post_id)


@router.patch('/comments/{comment_id}')
def edit_comment(comment_id: str, body: CommentEdit, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.edit_comment(session, token, body, comment_id=comment_id)


@router.delete('/comments/{comment_id}', status_code=204)
def delete_comment(comment_id: str, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    service.delete_content(session, token, 'Comment', comment_id)
    return Response(status_code=204)


@router.put('/posts/{post_id}/interactions/{kind}')
def interact(post_id: str, kind: InteractionKind, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.interact(session, token, post_id, kind, True)


@router.delete('/posts/{post_id}/interactions/{kind}')
def undo(post_id: str, kind: InteractionKind, token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.interact(session, token, post_id, kind, False)


@router.get('/me/posts')
def mine(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100), token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.my_posts(session, token, offset, limit)


@router.get('/me/favorites')
def favorites(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100), token: str = Depends(bearer_token), session: Session = Depends(get_session)):
    return service.my_posts(session, token, offset, limit, True)


@router.get('/images/{image_id}')
def image(image_id: str, credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer), session: Session = Depends(get_session)):
    data, media = service.image_data(session, image_id, credentials.credentials if credentials else None)
    return Response(data, media_type=media, headers={'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'})
