import {
  mockCompetitionDetails,
  mockCompetitions,
  mockRecruitments,
} from '@codestrike/contracts/mock'
import type { RecruitmentDetail } from '@codestrike/contracts'
import type { ApiRequest, ApiTransport } from './transport'
import { mockBusinessState } from '../mock/business-state'

export class MockTransport implements ApiTransport {
  async request<T>(request: ApiRequest): Promise<T> {
    await waitForMockLatency()

    const method = request.method || 'GET'

    if (method === 'GET' && request.path === '/prototype/actors') {
      return mockBusinessState.listActors() as T
    }

    if (method === 'GET' && request.path === '/prototype/actor') {
      return mockBusinessState.getActor() as T
    }

    if (method === 'POST' && request.path === '/prototype/actor') {
      return mockBusinessState.selectActor(readBodyId(request.body, 'actorId')) as T
    }

    if (method === 'GET' && request.path === '/applications/mine') {
      return mockBusinessState.listApplicationHistory() as T
    }

    if (method === 'POST' && request.path === '/applications') {
      return mockBusinessState.apply(readBodyId(request.body, 'teamId')) as T
    }

    const withdrawMatch = request.path.match(/^\/applications\/([^/]+)\/withdraw$/)
    if (method === 'POST' && withdrawMatch) {
      return mockBusinessState.withdraw(withdrawMatch[1]) as T
    }

    const reapplyMatch = request.path.match(/^\/applications\/([^/]+)\/reapply$/)
    if (method === 'POST' && reapplyMatch) {
      return mockBusinessState.reapply(reapplyMatch[1]) as T
    }

    if (method === 'GET' && request.path === '/captain/applications') {
      return mockBusinessState.listCaptainQueue() as T
    }

    const approveMatch = request.path.match(/^\/captain\/applications\/([^/]+)\/approve$/)
    if (method === 'POST' && approveMatch) {
      return mockBusinessState.approve(approveMatch[1]) as T
    }

    const rejectMatch = request.path.match(/^\/captain\/applications\/([^/]+)\/reject$/)
    if (method === 'POST' && rejectMatch) {
      return mockBusinessState.reject(rejectMatch[1]) as T
    }

    if (method === 'GET' && request.path === '/competitions?scenario=error') {
      throw new Error('The prototype competition feed is unavailable.')
    }

    if (method === 'GET' && request.path === '/competitions') {
      return mockCompetitions.map((competition) => ({ ...competition })) as T
    }

    const competitionRecruitmentMatch = request.path.match(
      /^\/competitions\/([^/]+)\/recruitments$/,
    )
    if (method === 'GET' && competitionRecruitmentMatch) {
      const competitionId = competitionRecruitmentMatch[1]
      return mockRecruitments
        .filter(
          (recruitment) =>
            recruitment.competitionId === competitionId && recruitment.isPubliclyListed,
        )
        .map(cloneRecruitment) as T
    }

    const competitionMatch = request.path.match(/^\/competitions\/([^/]+)$/)
    if (method === 'GET' && competitionMatch) {
      const competition = mockCompetitionDetails.find(
        (item) => item.id === competitionMatch[1],
      )
      if (!competition) throw new Error('Competition not found.')
      return {
        ...competition,
        community: { ...competition.community },
      } as T
    }

    const recruitmentMatch = request.path.match(/^\/recruitments\/([^/]+)$/)
    if (method === 'GET' && recruitmentMatch) {
      const recruitment = mockRecruitments.find((item) => item.id === recruitmentMatch[1])
      if (!recruitment || !recruitment.isPubliclyListed) {
        throw new Error('Recruitment not found in the public listing.')
      }
      return withCurrentTeamState(recruitment) as T
    }

    const reviewMatch = request.path.match(/^\/prototype\/recruitment-reviews\/([^/]+)$/)
    if (method === 'GET' && reviewMatch) {
      const recruitment = mockRecruitments.find((item) => item.id === reviewMatch[1])
      if (!recruitment || !mockBusinessState.canReviewRecruitment(recruitment.id)) {
        throw new Error('Design review denied for the selected prototype persona.')
      }
      return cloneRecruitment(recruitment) as T
    }

    throw new Error(`No mock registered for ${request.path}`)
  }
}

function waitForMockLatency(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 240))
}

function cloneRecruitment(item: RecruitmentDetail): RecruitmentDetail {
  return {
    ...item,
    requiredSkills: [...item.requiredSkills],
    revisionDraft: item.revisionDraft
      ? {
          ...item.revisionDraft,
          requiredSkills: [...item.revisionDraft.requiredSkills],
        }
      : undefined,
  }
}

function withCurrentTeamState(item: RecruitmentDetail): RecruitmentDetail {
  const clone = cloneRecruitment(item)
  const current = mockBusinessState.getTeamSnapshot(item.id)
  if (!current) return clone
  clone.memberCount = current.memberCount
  clone.lifecycle = current.lifecycle
  clone.publication = current.publication
  clone.recruitmentSwitch = current.recruitmentSwitch
  if (current.memberCount >= current.capacity) clone.availability = 'Full'
  return clone
}

function readBodyId(body: unknown, key: string): string {
  if (!body || typeof body !== 'object') throw new Error(`Missing ${key}.`)
  const value = (body as Record<string, unknown>)[key]
  if (typeof value !== 'string' || !value) throw new Error(`Missing ${key}.`)
  return value
}
