from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.core.security import bearer_token
from app.db.session import get_session
from app.modules.planner import service
from app.modules.planner.schemas import CreateResult, ItemCreate, ItemOut, ItemPage, ItemPatch

router = APIRouter(prefix="/planner", tags=["planner"])
Database = Annotated[Session, Depends(get_session)]
Token = Annotated[str, Depends(bearer_token)]
Page = Annotated[int, Query(ge=1)]
PageSize = Annotated[int, Query(alias="pageSize", ge=1, le=100)]


@router.post("/items", response_model=CreateResult, status_code=201)
def create_item(data: ItemCreate, session: Database, token: Token):
    return service.create_item(session, token, data)


@router.get("/items", response_model=ItemPage)
def items(session: Database, token: Token, date: date,
          view: Literal["day", "week"] = "day", page: Page = 1, page_size: PageSize = 50):
    return service.list_items(session, token, date, view, page, page_size)


@router.get("/day", response_model=ItemPage)
def day(session: Database, token: Token, date: date, page: Page = 1, page_size: PageSize = 50):
    return service.list_items(session, token, date, "day", page, page_size)


@router.get("/week", response_model=ItemPage)
def week(session: Database, token: Token, date: date, page: Page = 1, page_size: PageSize = 50):
    return service.list_items(session, token, date, "week", page, page_size)


@router.get("/items/{item_id}", response_model=ItemOut)
def get_item(item_id: str, session: Database, token: Token):
    return service.get_item(session, token, item_id)


@router.patch("/items/{item_id}", response_model=ItemOut)
def update_item(item_id: str, data: ItemPatch, session: Database, token: Token):
    return service.update_item(session, token, item_id, data)


@router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: str, session: Database, token: Token):
    service.delete_item(session, token, item_id)
    return Response(status_code=204)
