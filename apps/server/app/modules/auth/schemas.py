from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator
from pydantic.alias_generators import to_camel


class RequestModel(BaseModel):
    model_config = ConfigDict(extra='forbid', alias_generator=to_camel)


Username = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=64,
                                          pattern=r'^[a-zA-Z0-9_.-]+$')]
Password = Annotated[str, StringConstraints(min_length=10, max_length=128)]


class Register(RequestModel):
    username: Username
    password: Password

    @field_validator('username')
    @classmethod
    def normalize(cls, value: str) -> str:
        return value.lower()


class Login(RequestModel):
    username: Username
    password: str = Field(min_length=1, max_length=128)

    @field_validator('username')
    @classmethod
    def normalize(cls, value: str) -> str:
        return value.lower()


class ChangePassword(RequestModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: Password


class EmailRequest(RequestModel):
    email: str = Field(min_length=3, max_length=254)

    @field_validator('email')
    @classmethod
    def email_address(cls, value: str) -> str:
        import re
        value = value.strip().lower()
        if not re.fullmatch(r'[a-z0-9.!#$%&\x27*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}', value):
            raise ValueError('Invalid email address')
        return value


class VerifyEmail(EmailRequest):
    code: str = Field(pattern=r'^\d{6}$')


class RecoverPassword(VerifyEmail):
    new_password: Password


class UserOut(BaseModel):
    id: str
    username: str
    role: str
    email: str | None


class TokenOut(BaseModel):
    accessToken: str
    tokenType: str
    expiresIn: int
    user: UserOut


class MessageOut(BaseModel):
    message: str
