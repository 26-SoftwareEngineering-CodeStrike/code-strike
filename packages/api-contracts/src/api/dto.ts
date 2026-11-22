import type {
  ApplicationStatus,
  CompetitionDeadlineStatus,
  MembershipStatus,
  RecruitmentPublicationStatus,
  RecruitmentSwitch,
  TeamLifecycle,
} from '../enums'

/**
 * Wire DTOs mirroring the FastAPI schemas captured in
 * `docs/evidence/assignment5-alpha/sprint-new/openapi.json`.
 *
 * These describe what the backend sends and receives. They are deliberately
 * kept apart from the view models in `../types`, which describe what a screen
 * renders. `../adapters` converts one into the other.
 */

/** `HealthResponse` in `../types` already matches this schema exactly. */

export interface CompetitionDetailDto {
  id: string
  title: string
  category: string
  registrationDeadline: string
  deadlineStatus: CompetitionDeadlineStatus
  description: string
  eligibilityRules: string
  maxTeamSize: number
  officialSourceUrl: string
  coverImage: string | null
  published: boolean
  communityId: string
}

export interface SkillDto {
  id: string
  name: string
}

/** The backend spells the unmatched state `Not Matched`; the view model uses `NotMatched`. */
export type TeamMatchStatus = 'Matched' | 'Not Matched'

export interface TeamDto {
  id: string
  competitionId: string
  name: string
  summary: string
  memberCount: number
  capacity: number
  lifecycle: TeamLifecycle
  publication: RecruitmentPublicationStatus
  recruitmentSwitch: RecruitmentSwitch
  skills: SkillDto[]
  captainUsername: string
  match: TeamMatchStatus | null
}

export interface ApplicationDto {
  id: string
  competitionId: string
  teamId: string
  teamName: string
  status: ApplicationStatus
  reason: string | null
  createdAt: string
  decidedAt: string | null
}

export interface ApplicantPreviewDto {
  name: string | null
  college: string | null
  sex: string | null
  skills: SkillDto[]
  briefCv: string | null
}

export interface ReviewDto extends ApplicationDto {
  applicant: ApplicantPreviewDto
  match: TeamMatchStatus
  highlightName: boolean
}

export interface MemberDto {
  id: string
  userId: string
  teamId: string
  username: string
  status: MembershipStatus
  role: 'Captain' | 'Member'
}

export interface ContactDto {
  userId: string
  wechatId: string | null
  qqId: string | null
}

export interface UserDto {
  id: string
  username: string
  role: 'Student' | 'Admin'
  email: string | null
}

export interface TokenDto {
  accessToken: string
  tokenType: string
  expiresIn: number
  user: UserDto
}

export type PlannerItemKind = 'Course' | 'TimedPlan' | 'Todo'

export interface PlannerItemDto {
  id: string
  recurrenceId: string | null
  kind: PlannerItemKind
  title: string
  date: string
  startTime: string | null
  endTime: string | null
  startWeek: number | null
  weekday: number | null
  startPeriod: number | null
  endPeriod: number | null
  room: string | null
  description: string | null
  deadline: string | null
  completed: boolean
  createdAt: string
  updatedAt: string
}

export interface DashboardDto {
  competitionCount: number
  pendingApplicationCount: number
  activeTeamCount: number
  moderationCount: number
  competitions: CompetitionDetailDto[]
}
