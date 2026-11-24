import type {
  ApplicantPreviewDto,
  ApplicationDto,
  CompetitionDetailDto,
  ContactDto,
  DashboardDto,
  MemberDto,
  PlannerItemDto,
  RecruitmentRevisionRowDto,
  RecruitmentSettingsPayloadDto,
  ReviewDto,
  TeamDto,
  TeamHistoryDto,
  TeamMatchStatus,
} from '../api/dto'
import type { MembershipStatus } from '../enums'
import type {
  ActiveMemberContact,
  ApplicationHistoryItem,
  ApplicationSummary,
  CaptainPendingApplication,
  CompetitionDetail,
  CompetitionSummary,
  DashboardData,
  MyTeamItem,
  PendingApplicantProfile,
  PlannerOccurrence,
  RecruitmentAvailability,
  RecruitmentDetail,
  RecruitmentManagementView,
  RecruitmentModerationHistoryItem,
  RecruitmentRevisionDraft,
  RecruitmentSettings,
  RecruitmentSummary,
  SkillMatchStatus,
  TeamMemberView,
  TeamOperationsView,
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

/**
 * The backend addresses a member inside a team by the **user id** in every
 * member-scoped route (`/teams/{id}/members/{member_id}/contact`,
 * `DELETE /teams/{id}/members/{member_id}`, `POST /teams/{id}/captain`).
 * `MemberOut.id` is the membership row id and is never accepted by those
 * routes, so the view model carries the user id as the member handle.
 */
export function toTeamMemberView(dto: MemberDto): TeamMemberView {
  return {
    membershipId: dto.userId,
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

/**
 * A recruitment revision stores the skill ids the captain picked from the
 * administrator catalog, while the view model renders skill names. The
 * resolver turns one into the other; an id the catalog does not know is kept
 * verbatim rather than replaced by a name the server never sent.
 */
export function toRecruitmentSettings(
  payload: RecruitmentSettingsPayloadDto,
  resolveSkillName: (skillId: string) => string,
): RecruitmentSettings {
  return {
    teamName: payload.name,
    summary: payload.summary,
    capacity: payload.capacity,
    requiredSkills: payload.skillIds.map(resolveSkillName),
  }
}

export interface MyTeamContext {
  /** `GET /me/teams` does not carry the competition title. */
  competitionTitle: string
  membershipId: string
  membershipStatus: MembershipStatus
  membershipRole: 'Captain' | 'Member'
}

/**
 * The API decides captain authority on the server. The client derives the
 * captain-only actions from the membership role it read back, so the screen
 * offers a captain action only to the captain; the server still refuses it
 * for anyone else.
 */
export function toMyTeamItem(dto: TeamDto, context: MyTeamContext): MyTeamItem {
  const isCaptain = context.membershipRole === 'Captain'
  const isCurrent = dto.lifecycle === 'Active' && context.membershipStatus === 'Active'
  return {
    id: dto.id,
    name: dto.name,
    memberCount: dto.memberCount,
    capacity: dto.capacity,
    lifecycle: dto.lifecycle,
    publication: dto.publication,
    recruitmentSwitch: dto.recruitmentSwitch,
    competitionId: dto.competitionId,
    competitionTitle: context.competitionTitle,
    membershipId: context.membershipId,
    membershipStatus: context.membershipStatus,
    membershipRole: context.membershipRole,
    captainUsername: dto.captainUsername,
    canManageRecruitment: isCurrent && isCaptain,
    canReviewApplications: isCurrent && isCaptain,
    canManageMembers: isCurrent && isCaptain,
    canLeave: isCurrent && !isCaptain,
  }
}

/**
 * A past membership. The server reports the team state as it is now, and the
 * captain actions are not offered again because the membership has ended.
 */
export function toMyTeamHistoryItem(
  dto: TeamHistoryDto,
  context: { competitionTitle: string },
): MyTeamItem {
  return {
    id: dto.teamId,
    name: dto.teamName,
    memberCount: dto.memberCount,
    capacity: dto.capacity,
    lifecycle: dto.lifecycle,
    publication: dto.publication,
    recruitmentSwitch: dto.recruitmentSwitch,
    competitionId: dto.competitionId,
    competitionTitle: context.competitionTitle,
    membershipId: dto.id,
    membershipStatus: dto.status,
    membershipRole: dto.role,
    captainUsername: dto.captainUsername ?? '',
    canManageRecruitment: false,
    canReviewApplications: false,
    canManageMembers: false,
    canLeave: false,
  }
}

export interface ApplicationHistoryContext {
  competitionTitle: string
  isCurrentMembership: boolean
  canWithdraw: boolean
  canReapply: boolean
}

export function toApplicationHistoryItem(
  dto: ApplicationDto,
  context: ApplicationHistoryContext,
): ApplicationHistoryItem {
  const item: ApplicationHistoryItem = {
    id: dto.id,
    competitionId: dto.competitionId,
    teamId: dto.teamId,
    teamName: dto.teamName,
    status: dto.status,
    competitionTitle: context.competitionTitle,
    submittedDate: dto.createdAt,
    updatedDate: dto.decidedAt ?? dto.createdAt,
    isCurrentMembership: context.isCurrentMembership,
    canWithdraw: context.canWithdraw,
    canReapply: context.canReapply,
  }
  if (dto.reason) item.reason = dto.reason
  return item
}

export interface RecruitmentManagementSource {
  team: TeamDto
  competitionTitle: string
  competitionMaximumTeamSize: number
  /** Newest first, as `GET /teams/{team_id}/recruitment/revisions` returns them. */
  revisions: RecruitmentRevisionRowDto[]
  resolveSkillName: (skillId: string) => string
}

/**
 * The API splits the recruitment screen across the team, the competition and
 * the revision list. The newest `Pending` revision is the draft under review;
 * when there is none, the newest `Rejected` revision is kept visible so the
 * captain sees why the last submission did not pass.
 */
export function toRecruitmentManagementView(
  source: RecruitmentManagementSource,
): RecruitmentManagementView {
  const pending = source.revisions.find((revision) => revision.status === 'Pending')
  const rejected = source.revisions.find((revision) => revision.status === 'Rejected')
  const draft = pending ?? rejected
  const reviewHistory: RecruitmentModerationHistoryItem[] = source.revisions
    .filter((revision) => revision.status === 'Approved' || revision.status === 'Rejected')
    .map((revision) => ({
      revisionId: revision.id,
      decision: revision.status as RecruitmentModerationHistoryItem['decision'],
      settings: toRecruitmentSettings(revision.payload, source.resolveSkillName),
    }))
  const view: RecruitmentManagementView = {
    teamId: source.team.id,
    competitionId: source.team.competitionId,
    competitionTitle: source.competitionTitle,
    competitionMaximumTeamSize: source.competitionMaximumTeamSize,
    memberCount: source.team.memberCount,
    lifecycle: source.team.lifecycle,
    publication: source.team.publication,
    recruitmentSwitch: source.team.recruitmentSwitch,
    effective: {
      teamName: source.team.name,
      summary: source.team.summary,
      capacity: source.team.capacity,
      requiredSkills: source.team.skills.map((skill) => skill.name),
    },
    reviewHistory,
    canModerateInPrototype: false,
  }
  if (draft) {
    view.draft = toRecruitmentSettings(draft.payload, source.resolveSkillName)
    view.draftRevisionId = draft.id
  }
  return view
}

export function toTeamOperationsView(
  team: MyTeamItem,
  members: TeamMemberView[],
  contacts?: ActiveMemberContact[],
): TeamOperationsView {
  const view: TeamOperationsView = { team, members }
  if (contacts) view.contacts = contacts
  return view
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
    ...(dto.startWeek !== null ? { startWeek: dto.startWeek } : {}),
    ...(dto.weekday !== null ? { weekday: dto.weekday } : {}),
    ...(dto.startPeriod !== null ? { startPeriod: dto.startPeriod } : {}),
    ...(dto.endPeriod !== null ? { endPeriod: dto.endPeriod } : {}),
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
