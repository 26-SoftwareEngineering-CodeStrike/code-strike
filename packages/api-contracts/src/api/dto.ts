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

/**
 * The body of a recruitment revision. The backend stores the skill *ids* the
 * captain picked from the administrator catalog, not their names.
 */
export interface RecruitmentSettingsPayloadDto {
  name: string
  summary: string
  capacity: number
  skillIds: string[]
}

/** The revision created by `POST /teams` when `submitRecruitment` is true. */
export interface RecruitmentRevisionDto {
  id: string
  teamId: string
  status: string
  publication?: string
  proposed?: RecruitmentSettingsPayloadDto
}

/** One row of `GET /teams/{team_id}/recruitment/revisions`. */
export interface RecruitmentRevisionRowDto {
  id: string
  status: string
  payload: RecruitmentSettingsPayloadDto
  reason: string | null
  createdAt: string
}

export interface TeamCreatedDto extends TeamDto {
  revision: RecruitmentRevisionDto | null
}

/** One row of `GET /me/team-history`. */
export interface TeamHistoryDto {
  id: string
  teamId: string
  teamName: string
  competitionId: string
  status: MembershipStatus
  joinedAt: string
  endedAt: string | null
  reason: string | null
  lifecycle: TeamLifecycle
  publication: RecruitmentPublicationStatus
  recruitmentSwitch: RecruitmentSwitch
  capacity: number
  captainUsername: string | null
  memberCount: number
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

export interface RegisterRequest {
  username: string
  password: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface MessageDto {
  message: string
}

export interface ProfileDto {
  name: string | null
  college: string | null
  major: string | null
  academicYear: string | null
  sex: string | null
  briefCv: string | null
  wechatId: string | null
  qqId: string | null
  mbti: string | null
  hobbies: string | null
  userId: string
  skills: SkillDto[]
  skillIds: string[]
  missingFields: string[]
  complete: boolean
}

export interface ProfileUpdateRequest {
  name?: string
  college?: string
  major?: string
  academicYear?: string
  sex?: string
  briefCv?: string
  wechatId?: string
  qqId?: string
  mbti?: string
  hobbies?: string
  skillIds?: string[]
}

/**
 * The profile fields the SRS marks as mandatory. The backend reports the
 * fields a profile is still missing under the same names.
 */
export const PROFILE_MANDATORY_FIELDS = [
  'name',
  'college',
  'major',
  'academicYear',
  'sex',
  'briefCv',
] as const

export type ProfileMandatoryField = (typeof PROFILE_MANDATORY_FIELDS)[number]

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
