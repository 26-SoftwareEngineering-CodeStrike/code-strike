import type { CompetitionDetailDto, RecruitmentSettingsPayloadDto, TeamDto } from './dto'

export const ADMIN_REVISION_STATUSES = ['Pending', 'Approved', 'Rejected', 'Superseded'] as const
export type AdminRevisionStatus = typeof ADMIN_REVISION_STATUSES[number]
export type AdminContentKind = 'Post' | 'Comment' | 'Competition'
export type AdminModerationAction = 'Approve' | 'Reject' | 'Remove'
export type AdminCompetitionFields = Omit<CompetitionDetailDto, 'id' | 'communityId' | 'deadlineStatus'>

interface RevisionFields {
  id: string
  revisionId: string
  competitionId: string
  username: string
  status: AdminRevisionStatus
  text: string
  createdAt: string
}

export interface AdminPostPayloadDto extends RevisionFields {
  links: string[]
  imageIds: string[]
  likes: number
  favorites: number
}

export interface AdminCommentPayloadDto extends RevisionFields {
  postId: string
  parentId: string | null
}

interface ContentPayloads {
  Post: AdminPostPayloadDto
  Comment: AdminCommentPayloadDto
  Competition: Omit<AdminCompetitionFields, 'published'>
}

export interface AdminRevisionHistoryDto {
  revisionId: string
  status: AdminRevisionStatus
  createdAt: string
}

/** GET /moderation and GET /moderation/{revisionId}. Only detail includes history. */
export type AdminContentRevisionDto = {
  [K in AdminContentKind]: {
    id: string
    revisionId: string
    targetId: string
    kind: K
    status: AdminRevisionStatus
    proposed: ContentPayloads[K]
    effective?: ContentPayloads[K]
    history?: AdminRevisionHistoryDto[]
    deleted?: boolean
    removed?: boolean
  }
}[AdminContentKind]

/** GET /moderation/recruitments and GET /moderation/recruitments/{revisionId}. */
export interface AdminRecruitmentRevisionDto {
  id: string
  teamId: string
  status: AdminRevisionStatus
  proposed: RecruitmentSettingsPayloadDto
  effective?: Omit<TeamDto, 'match'>
  reason?: string | null
  removed?: boolean
}

export type AdminContentDecisionRequest =
  | { action: 'Approve'; reason?: string }
  | { action: 'Reject' | 'Remove'; reason: string }

export interface AdminRecruitmentDecisionRequest {
  decision: 'Approved' | 'Rejected'
  reason?: string
}
