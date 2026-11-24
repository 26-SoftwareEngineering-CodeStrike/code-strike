import { ADMIN_REVISION_STATUSES } from '@codestrike/contracts'
import type {
  AdminContentDecisionRequest, AdminContentKind, AdminContentRevisionDto, AdminModerationAction,
  AdminRecruitmentDecisionRequest, AdminRecruitmentRevisionDto, AdminRevisionHistoryDto,
  AdminRevisionStatus, ApiRequest,
} from '@codestrike/contracts'

export const revisionStatuses = ADMIN_REVISION_STATUSES
export type RevisionStatus = AdminRevisionStatus
export type RevisionKind = AdminContentKind | 'Recruitment'
export type Queue = 'Content' | 'Competition' | 'Recruitment'
export type Action = AdminModerationAction
export type Payload = Record<string, unknown>

export interface Revision {
  kind: RevisionKind
  revisionId: string
  targetId: string
  status: RevisionStatus
  removed?: boolean
  deleted?: boolean
  proposed: Payload
  effective?: Payload
  reason?: string | null
  history?: AdminRevisionHistoryDto[]
}

function fromContent(row: AdminContentRevisionDto): Revision {
  return { ...row, proposed: { ...row.proposed }, effective: row.effective && { ...row.effective } }
}

function fromRecruitment({ id, teamId, proposed, effective, ...revision }: AdminRecruitmentRevisionDto): Revision {
  return { ...revision, kind: 'Recruitment', revisionId: id, targetId: teamId,
    proposed: { ...proposed }, effective: effective && { ...effective } }
}

export function actionsFor(row: Revision): Action[] {
  if (row.removed || row.deleted) return []
  const actions: Action[] = row.status === 'Pending' ? ['Approve', 'Reject'] : []
  if (row.kind !== 'Competition') actions.push('Remove')
  return actions
}

export function createModerationApi(request: <T>(options: ApiRequest) => Promise<T>) {
  const recruitmentPath = '/moderation/recruitments'
  return {
    actionsFor,
    async listRevisions(queue: Queue, status: RevisionStatus, offset: number, limit: number) {
      const items: Revision[] = []
      const batchSize = queue === 'Competition' ? 100 : Math.min(limit + 1, 100)
      // The server pages posts, comments and submissions together. The cursor
      // points at the next matching server row, including across sparse pages.
      for (let start = offset; ; start += batchSize) {
        const query = { status, offset: start, limit: batchSize }
        const rows = queue === 'Recruitment'
          ? (await request<AdminRecruitmentRevisionDto[]>({ path: recruitmentPath, query })).map(fromRecruitment)
          : (await request<AdminContentRevisionDto[]>({ path: '/moderation', query })).map(fromContent)
        for (const [index, row] of rows.entries()) {
          if (queue === 'Competition' && row.kind !== 'Competition') continue
          if (items.length === limit) return { items, nextOffset: start + index }
          items.push(row)
        }
        if (rows.length < batchSize) return { items, nextOffset: null }
      }
    },
    async getRevision(row: Revision): Promise<Revision> {
      const id = encodeURIComponent(row.revisionId)
      if (row.kind === 'Recruitment') {
        return fromRecruitment(await request<AdminRecruitmentRevisionDto>({ path: recruitmentPath + '/' + id }))
      }
      return fromContent(await request<AdminContentRevisionDto>({ path: '/moderation/' + id }))
    },
    async decide(row: Revision, action: Action, input = '') {
      if (!actionsFor(row).includes(action)) throw new Error('This action is unavailable for this revision.')
      const reason = input.trim()
      const id = encodeURIComponent(row.revisionId)
      if (row.kind === 'Recruitment') {
        if (action === 'Remove') {
          return request({ method: 'DELETE', path: recruitmentPath + '/team/' + encodeURIComponent(row.targetId) })
        }
        const body: AdminRecruitmentDecisionRequest = { decision: action === 'Approve' ? 'Approved' : 'Rejected', ...(reason && { reason }) }
        return request({ method: 'POST', path: recruitmentPath + '/' + id + '/decision', body })
      }
      if (action !== 'Approve' && !reason) throw new Error('A reason is required for this action.')
      const body: AdminContentDecisionRequest = action === 'Approve' && !reason ? { action } : { action, reason }
      return request({ method: 'POST', path: '/moderation/' + id, body })
    },
    getPostImage: (id: string) => request<Blob>({ path: '/images/' + encodeURIComponent(id) }),
  }
}
