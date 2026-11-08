from typing import Literal
from pydantic import Field, model_validator
from app.modules.competitions.schemas import Schema


class Decision(Schema):
    action: Literal['Approve', 'Reject', 'Remove']
    reason: str | None = Field(None, min_length=1, max_length=1000)

    @model_validator(mode='after')
    def reason_required(self):
        if self.action in ('Reject', 'Remove') and not self.reason:
            raise ValueError('A reason is required for rejection/removal')
        return self
