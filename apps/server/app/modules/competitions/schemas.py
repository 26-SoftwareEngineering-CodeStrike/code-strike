from datetime import datetime, timezone
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


class Schema(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class CompetitionInput(Schema):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=20000)
    category: str = Field(min_length=1, max_length=100)
    registrationDeadline: datetime
    eligibilityRules: str = Field(min_length=1, max_length=10000)
    maxTeamSize: int = Field(ge=1, le=10000, strict=True)
    officialSourceUrl: HttpUrl = Field(max_length=2048)
    coverImage: HttpUrl | None = Field(None, max_length=2048)

    @field_validator('registrationDeadline')
    @classmethod
    def utc(cls, value: datetime) -> datetime:
        return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value

    def columns(self) -> dict:
        return dict(title=self.title, description=self.description, category=self.category,
                    registration_deadline=self.registrationDeadline, eligibility_rules=self.eligibilityRules,
                    max_team_size=self.maxTeamSize, official_source_url=str(self.officialSourceUrl),
                    cover_image=str(self.coverImage) if self.coverImage else None)


class CompetitionCreate(CompetitionInput):
    published: bool = True


class CompetitionUpdate(Schema):
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, min_length=1, max_length=20000)
    category: str | None = Field(None, min_length=1, max_length=100)
    registrationDeadline: datetime | None = None
    eligibilityRules: str | None = Field(None, min_length=1, max_length=10000)
    maxTeamSize: int | None = Field(None, ge=1, le=10000, strict=True)
    officialSourceUrl: HttpUrl | None = Field(None, max_length=2048)
    coverImage: HttpUrl | None = Field(None, max_length=2048)
    published: bool | None = None

    @field_validator('*')
    @classmethod
    def nonnull(cls, value, info):
        if value is None and info.field_name != 'coverImage':
            raise ValueError('This field cannot be null')
        return value


class CompetitionSummary(Schema):
    id: str
    title: str
    category: str
    registrationDeadline: datetime
    deadlineStatus: str


class CompetitionDetail(CompetitionSummary):
    description: str
    eligibilityRules: str
    maxTeamSize: int
    officialSourceUrl: str
    coverImage: str | None
    published: bool
    communityId: str
