from pydantic import Field, field_validator

from app.modules.auth.schemas import RequestModel


class SkillWrite(RequestModel):
    name: str = Field(min_length=1, max_length=100)

    @field_validator('name')
    @classmethod
    def trim(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError('Skill name cannot be blank')
        return value
