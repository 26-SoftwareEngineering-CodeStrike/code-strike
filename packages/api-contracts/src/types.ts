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

