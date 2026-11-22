from pydantic import Field, field_validator

from app.modules.auth.schemas import RequestModel


class ProfileUpdate(RequestModel):
    name: str = Field(default='', max_length=100)
    college: str = Field(default='', max_length=200)
    major: str = Field(default='', max_length=200)
    academic_year: str = Field(default='', max_length=40)
    sex: str = Field(default='', max_length=30)
    brief_cv: str = Field(default='', max_length=10000)
    wechat_id: str = Field(default='', max_length=100)
    qq_id: str = Field(default='', max_length=100)
    mbti: str = Field(default='', max_length=4)
    hobbies: str = Field(default='', max_length=2000)
    skill_ids: list[str] = Field(default_factory=list, max_length=100)

    @field_validator('name', 'college', 'major', 'academic_year', 'sex', 'brief_cv',
                     'wechat_id', 'qq_id', 'mbti', 'hobbies')
    @classmethod
    def trim(cls, value: str) -> str:
        return value.strip()

    @field_validator('mbti')
    @classmethod
    def valid_mbti(cls, value: str) -> str:
        import re
        value = value.upper()
        if value and not re.fullmatch('[IE][NS][FT][JP]', value):
            raise ValueError('Invalid MBTI type')
        return value

    @field_validator('skill_ids')
    @classmethod
    def valid_ids(cls, value: list[str]) -> list[str]:
        from uuid import UUID
        return list(dict.fromkeys(str(UUID(item)) for item in value))
