from typing import Literal
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class TeamFields(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True, str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=150)
    summary: str = Field(min_length=1, max_length=10000)
    capacity: int = Field(ge=1, le=10000)
    skill_ids: list[str] = Field(alias="skillIds", min_length=1, max_length=100)


class TeamCreate(TeamFields):
    competition_id: str = Field(alias="competitionId")
    submit_recruitment: bool = Field(default=False, alias="submitRecruitment")


class SwitchInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    state: Literal["Open", "Closed"]


class TransferInput(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    member_id: str = Field(alias="memberId")


class DecisionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: Literal["Approved", "Rejected"]
    reason: str = Field(default="", max_length=255)


class SkillOut(BaseModel):
    id: str
    name: str


class TeamOut(BaseModel):
    id: str
    competitionId: str
    name: str
    summary: str
    memberCount: int
    capacity: int
    lifecycle: Literal['Active', 'Dissolved']
    publication: Literal['Private', 'Pending', 'Published', 'Delisted', 'Rejected']
    recruitmentSwitch: Literal['Open', 'Closed']
    skills: list[SkillOut]
    captainUsername: str
    match: Literal['Matched', 'Not Matched'] | None = None


class TeamCreated(TeamOut):
    revision: dict | None = None


class ApplicationOut(BaseModel):
    id: str
    competitionId: str
    teamId: str
    teamName: str
    status: Literal['Pending', 'Approved', 'Rejected', 'Withdrawn', 'Invalidated']
    reason: str | None
    createdAt: datetime
    decidedAt: datetime | None


class ApplicantPreview(BaseModel):
    name: str | None
    college: str | None
    sex: str | None
    skills: list[SkillOut]
    briefCv: str | None


class ReviewOut(ApplicationOut):
    applicant: ApplicantPreview
    match: Literal['Matched', 'Not Matched']
    highlightName: bool


class MemberOut(BaseModel):
    id: str
    userId: str
    teamId: str
    username: str
    status: Literal['Active', 'Ended']
    role: Literal['Captain', 'Member']


class ContactOut(BaseModel):
    userId: str
    wechatId: str | None
    qqId: str | None
