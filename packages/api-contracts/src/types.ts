import type {
  ApplicationStatus,
  CompetitionDeadlineStatus,
  MembershipStatus,
  RecruitmentPublicationStatus,
  RecruitmentSwitch,
  TeamLifecycle,
} from './enums'

export interface HealthResponse {
  status: 'ok'
  service: string
  api_version: 'v1'
}

export interface CompetitionSummary {
  id: string
  title: string
  category: string
  registrationDeadline: string
  deadlineStatus: CompetitionDeadlineStatus
  eligibilitySummary: string
  coverTone: 'Cobalt' | 'Amber' | 'Forest'
}

export interface CompetitionDetail extends CompetitionSummary {
  description: string
  eligibility: string
  maximumTeamSize: number
  officialSourceUrl: string
  community: {
    discussionCount: number
    resourceCount: number
    publishedRecruitmentCount: number
  }
}

export type SkillMatchStatus = 'Matched' | 'NotMatched'
export type RecruitmentAvailability =
  | 'Open'
  | 'Full'
  | 'ManuallyClosed'
  | 'RegistrationClosed'
  | 'Delisted'

export interface RecruitmentSummary extends TeamStateSummary {
  competitionId: string
  captainUsername: string
  summary: string
  requiredSkills: string[]
  matchStatus: SkillMatchStatus
  availability: RecruitmentAvailability
  isPubliclyListed: boolean
}

export interface RecruitmentRevisionDraft {
  teamName: string
  summary: string
  capacity: number
  requiredSkills: string[]
}

export interface RecruitmentDetail extends RecruitmentSummary {
  competitionTitle: string
  competitionDeadline: string
  revisionDraft?: RecruitmentRevisionDraft
}

export interface ApplicationSummary {
  id: string
  competitionId: string
  teamName: string
  status: ApplicationStatus
  reason?: string
}

export type PrototypeActorRole =
  | 'Visitor'
  | 'Student'
  | 'CurrentCaptain'
  | 'FormerCaptain'
  | 'Admin'

export interface PrototypeActor {
  id: string
  label: string
  role: PrototypeActorRole
  studentId?: string
  captainTeamId?: string
}

export interface ApplicationHistoryItem extends ApplicationSummary {
  teamId: string
  competitionTitle: string
  submittedDate: string
  updatedDate: string
  isCurrentMembership: boolean
  canWithdraw: boolean
  canReapply: boolean
}

/** Sanitized pre-admission DTO. These are the only applicant profile fields it can carry. */
export interface PendingApplicantProfile {
  name: string
  college: string
  sex: string
  skillTags: string[]
  briefCv: string
}

export interface CaptainPendingApplication {
  id: string
  competitionId: string
  teamId: string
  teamName: string
  submittedDate: string
  matchStatus: SkillMatchStatus
  applicant: PendingApplicantProfile
}

/** Separate post-admission DTO; never used by the Pending review queue. */
export interface ActiveMemberContact {
  membershipId: string
  memberName: string
  wechatId?: string
  qqId?: string
}

export interface MockCommandResult<T = undefined> {
  ok: boolean
  code: string
  message: string
  data?: T
}

export interface TeamStateSummary {
  id: string
  name: string
  memberCount: number
  capacity: number
  lifecycle: TeamLifecycle
  publication: RecruitmentPublicationStatus
  recruitmentSwitch: RecruitmentSwitch
}

export interface MembershipSummary {
  id: string
  teamId: string
  status: MembershipStatus
  role: 'Captain' | 'Member'
}

export interface ApiErrorPayload {
  code: string
  message: string
  details?: Record<string, unknown>
  requestId?: string
}

