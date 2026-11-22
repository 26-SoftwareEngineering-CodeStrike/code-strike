import type {
  ApplicantPreviewDto,
  ApplicationDto,
  CompetitionDetailDto,
  ContactDto,
  DashboardDto,
  MemberDto,
  PlannerItemDto,
  ReviewDto,
  TeamDto,
  TeamMatchStatus,
} from '../api/dto'
import type {
  ActiveMemberContact,
  ApplicationSummary,
  CaptainPendingApplication,
  CompetitionDetail,
  CompetitionSummary,
  DashboardData,
  PendingApplicantProfile,
  PlannerOccurrence,
  RecruitmentAvailability,
  RecruitmentDetail,
  RecruitmentRevisionDraft,
  RecruitmentSummary,
  SkillMatchStatus,
  TeamMemberView,
} from '../types'

/**
 * Explicit conversions from backend wire DTOs to the view models the
 * Assignment 4 prototype renders. Fields the backend does not expose are
 * either derived deterministically or reported as missing context, never
 * silently defaulted to a value the server never sent.
 */

const COVER_TONES = ['Cobalt', 'Amber', 'Forest'] as const

export type CompetitionCoverTone = (typeof COVER_TONES)[number]

/** The backend has no cover tone; it is a prototype presentation field derived from the id. */
export function deriveCoverTone(id: string): CompetitionCoverTone {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0
  }
  return COVER_TONES[hash % COVER_TONES.length]
}

export function summarizeEligibility(eligibilityRules: string, maxLength = 120): string {
  const normalized = eligibilityRules.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength).trimEnd()}…`
}

export function toCompetitionSummary(dto: CompetitionDetailDto): CompetitionSummary {
  return {
    id: dto.id,
    title: dto.title,
    category: dto.category,
    registrationDeadline: dto.registrationDeadline,
    deadlineStatus: dto.deadlineStatus,
    eligibilitySummary: summarizeEligibility(dto.eligibilityRules),
    coverTone: deriveCoverTone(dto.id),
  }
}

export interface CommunityCounts {
  discussionCount?: number
  resourceCount?: number
  publishedRecruitmentCount?: number
}

/**
 * The backend exposes no aggregate community counters, so discussion and
 * resource counts stay at zero until the content module is wired in a later
 * sprint task.
 */
export function toCompetitionDetail(
  dto: CompetitionDetailDto,
  community: CommunityCounts = {},
): CompetitionDetail {
  return {
    ...toCompetitionSummary(dto),
    description: dto.description,
    eligibility: dto.eligibilityRules,
    maximumTeamSize: dto.maxTeamSize,
    officialSourceUrl: dto.officialSourceUrl,
    community: {
      discussionCount: community.discussionCount ?? 0,
      resourceCount: community.resourceCount ?? 0,
      publishedRecruitmentCount: community.publishedRecruitmentCount ?? 0,
    },
  }
}

export function toSkillMatchStatus(match: TeamMatchStatus | null): SkillMatchStatus {
  return match === 'Matched' ? 'Matched' : 'NotMatched'
}

export interface RecruitmentContext {
  competitionTitle?: string
  competitionDeadline?: string
  deadlinePassed?: boolean
  revisionDraft?: RecruitmentRevisionDraft
}

export function toRecruitmentAvailability(
  dto: TeamDto,
  context: RecruitmentContext = {},
): RecruitmentAvailability {
  if (dto.lifecycle === 'Dissolved') return 'Delisted'
  if (dto.publication !== 'Published') return 'Delisted'
  if (context.deadlinePassed) return 'RegistrationClosed'
  if (dto.recruitmentSwitch === 'Closed') return 'ManuallyClosed'
  if (dto.memberCount >= dto.capacity) return 'Full'
  return 'Open'
}

export function toRecruitmentSummary(
  dto: TeamDto,
  context: RecruitmentContext = {},
): RecruitmentSummary {
  return {
    id: dto.id,
    name: dto.name,
    memberCount: dto.memberCount,
    capacity: dto.capacity,
    lifecycle: dto.lifecycle,
    publication: dto.publication,
    recruitmentSwitch: dto.recruitmentSwitch,
    competitionId: dto.competitionId,
    captainUsername: dto.captainUsername,
    summary: dto.summary,
    requiredSkills: dto.skills.map((skill) => skill.name),
    matchStatus: toSkillMatchStatus(dto.match),
    availability: toRecruitmentAvailability(dto, context),
    isPubliclyListed: dto.publication === 'Published',
  }
}

export function toRecruitmentDetail(
  dto: TeamDto,
  context: RecruitmentContext = {},
): RecruitmentDetail {
  const detail: RecruitmentDetail = {
    ...toRecruitmentSummary(dto, context),
    competitionTitle: context.competitionTitle ?? '',
    competitionDeadline: context.competitionDeadline ?? '',
  }
  if (context.revisionDraft) detail.revisionDraft = context.revisionDraft
  return detail
}

export function toTeamMemberView(dto: MemberDto): TeamMemberView {
  return {
    membershipId: dto.id,
    username: dto.username,
    role: dto.role,
    status: dto.status,
  }
}

export function toActiveMemberContact(
  dto: ContactDto,
  context: { membershipId: string; memberName: string },
): ActiveMemberContact {
  return {
    membershipId: context.membershipId,
    memberName: context.memberName,
    wechatId: dto.wechatId ?? undefined,
    qqId: dto.qqId ?? undefined,
  }
}

export function toApplicationSummary(dto: ApplicationDto): ApplicationSummary {
  const summary: ApplicationSummary = {
    id: dto.id,
    competitionId: dto.competitionId,
    teamName: dto.teamName,
    status: dto.status,
  }
  if (dto.reason) summary.reason = dto.reason
  return summary
}

export function toPendingApplicantProfile(dto: ApplicantPreviewDto): PendingApplicantProfile {
  return {
    name: dto.name ?? '',
    college: dto.college ?? '',
    sex: dto.sex ?? '',
    skillTags: dto.skills.map((skill) => skill.name),
    briefCv: dto.briefCv ?? '',
  }
}

export function toCaptainPendingApplication(dto: ReviewDto): CaptainPendingApplication {
  return {
    id: dto.id,
    competitionId: dto.competitionId,
    teamId: dto.teamId,
    teamName: dto.teamName,
    submittedDate: dto.createdAt,
    matchStatus: toSkillMatchStatus(dto.match),
    applicant: toPendingApplicantProfile(dto.applicant),
  }
}

export function toPlannerOccurrence(
  dto: PlannerItemDto,
  context: { occurrenceNumber?: number; occurrenceCount?: number } = {},
): PlannerOccurrence {
  return {
    id: dto.id,
    batchId: dto.recurrenceId ?? dto.id,
    type: dto.kind,
    title: dto.title,
    actualDate: dto.date,
    startTime: dto.startTime ?? undefined,
    endTime: dto.endTime ?? undefined,
    room: dto.room ?? undefined,
    description: dto.description ?? undefined,
    deadline: dto.deadline ?? undefined,
    completed: dto.completed,
    occurrenceNumber: context.occurrenceNumber ?? 1,
    occurrenceCount: context.occurrenceCount ?? 1,
  }
}

export function toDashboard(dto: DashboardDto): DashboardData {
  return {
    competitionCount: dto.competitionCount,
    pendingApplicationCount: dto.pendingApplicationCount,
    activeTeamCount: dto.activeTeamCount,
    moderationCount: dto.moderationCount,
    competitions: dto.competitions.map((competition) => toCompetitionSummary(competition)),
  }
}
