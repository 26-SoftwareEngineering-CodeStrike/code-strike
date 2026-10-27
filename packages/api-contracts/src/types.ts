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

