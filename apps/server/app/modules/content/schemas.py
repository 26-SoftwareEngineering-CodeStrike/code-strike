import base64
import binascii
from datetime import datetime
from typing import Literal
from pydantic import Field, HttpUrl, field_validator, model_validator
from app.modules.competitions.schemas import Schema
from .images import validate_image, MAX_IMAGE_BYTES


class ImageInput(Schema):
    dataBase64: str = Field(max_length=4 * ((MAX_IMAGE_BYTES + 2) // 3), min_length=1)

    @field_validator('dataBase64')
    @classmethod
    def validate_data(cls, value: str) -> str:
        try:
            data = base64.b64decode(value, validate=True)
        except (binascii.Error, ValueError):
            raise ValueError('Invalid base64 image') from None
        validate_image(data)
        return value


class PostInput(Schema):
    text: str = Field('', max_length=20000)
    links: list[HttpUrl] = Field(default_factory=list, max_length=20)
    images: list[ImageInput] = Field(default_factory=list, max_length=9)

    @model_validator(mode='after')
    def nonempty(self):
        if not self.text and not self.links and not self.images:
            raise ValueError('A post must contain text, links or images')
        if any(len(str(link)) > 2048 for link in self.links):
            raise ValueError('Link too long')
        return self


class CommentInput(Schema):
    text: str = Field(min_length=1, max_length=10000)
    parentId: str | None = Field(None, min_length=36, max_length=36)


class CommentEdit(Schema):
    text: str = Field(min_length=1, max_length=10000)


InteractionKind = Literal['Like', 'Favorite']


class PostOut(Schema):
    id: str
    competitionId: str
    username: str
    revisionId: str
    status: str
    text: str
    links: list[str]
    imageIds: list[str]
    likes: int
    favorites: int
    createdAt: datetime


class CommentOut(Schema):
    id: str
    postId: str
    competitionId: str
    parentId: str | None
    username: str
    revisionId: str
    status: str
    text: str
    createdAt: datetime
