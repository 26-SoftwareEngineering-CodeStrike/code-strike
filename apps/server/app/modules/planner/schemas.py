from datetime import date as Date, datetime, time, timezone
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel


class Schema(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True,
                              from_attributes=True, extra="forbid", str_strip_whitespace=True)


class CreateBase(Schema):
    title: str = Field(min_length=1, max_length=255)
    # Operational batch limit, not a university semester length.
    occurrence_count: int = Field(default=1, ge=1, le=520, strict=True)


class CourseCreate(CreateBase):
    kind: Literal["Course"]
    start_week: int = Field(ge=1, le=521723, strict=True)
    weekday: int = Field(ge=1, le=7, strict=True)
    start_period: int = Field(ge=1, strict=True)
    end_period: int = Field(ge=1, strict=True)
    room: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def ordered_periods(self):
        if self.start_period > self.end_period:
            raise ValueError("endPeriod must not precede startPeriod")
        return self


class TimedPlanCreate(CreateBase):
    kind: Literal["TimedPlan"]
    date: Date
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def ordered_times(self):
        if self.start_time.tzinfo or self.end_time.tzinfo:
            raise ValueError("Use local wall-clock times without timezone offsets")
        if self.start_time.microsecond or self.end_time.microsecond:
            raise ValueError("Times must have whole-second precision")
        if self.start_time >= self.end_time:
            raise ValueError("endTime must follow startTime on the selected date")
        return self


class TodoCreate(CreateBase):
    kind: Literal["Todo"]
    date: Date
    description: str | None = Field(default=None, max_length=10000)
    deadline: datetime | None = None

    @field_validator("deadline")
    @classmethod
    def utc_deadline(cls, value):
        if value is not None and value.tzinfo is not None:
            return value.astimezone(timezone.utc).replace(tzinfo=None)
        return value  # offset-free input is interpreted as UTC


ItemCreate = Annotated[CourseCreate | TimedPlanCreate | TodoCreate, Field(discriminator="kind")]


class ItemPatch(Schema):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    date: Date | None = None
    start_week: int | None = Field(default=None, ge=1, le=521723, strict=True)
    weekday: int | None = Field(default=None, ge=1, le=7, strict=True)
    start_period: int | None = Field(default=None, ge=1, strict=True)
    end_period: int | None = Field(default=None, ge=1, strict=True)
    start_time: time | None = None
    end_time: time | None = None
    room: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=10000)
    deadline: datetime | None = None
    completed: bool | None = Field(default=None, strict=True)

    @model_validator(mode="after")
    def nonempty(self):
        if not self.model_fields_set:
            raise ValueError("Supply at least one changed field")
        for name in self.model_fields_set - {"room", "description", "deadline"}:
            if getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class ItemOut(Schema):
    id: str
    recurrence_id: str | None
    kind: Literal["Course", "TimedPlan", "Todo"]
    title: str
    date: Date
    start_time: time | None
    end_time: time | None
    start_week: int | None
    weekday: int | None
    start_period: int | None
    end_period: int | None
    room: str | None
    description: str | None
    deadline: datetime | None
    completed: bool
    created_at: datetime
    updated_at: datetime


class SkippedOccurrence(Schema):
    date: Date
    reason: str = "Duplicate course occurrence skipped."


class CreateResult(Schema):
    items: list[ItemOut]
    skipped: list[SkippedOccurrence]


class ItemPage(Schema):
    items: list[ItemOut]
    total: int
    page: int
    page_size: int
    start_date: Date
    end_date: Date
