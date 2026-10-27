import {
  mockCompetitionDetails,
  mockCompetitions,
  mockRecruitments,
} from '@codestrike/contracts/mock'
import type { RecruitmentDetail } from '@codestrike/contracts'
import type { ApiRequest, ApiTransport } from './transport'

export class MockTransport implements ApiTransport {
  async request<T>(request: ApiRequest): Promise<T> {
    if (request.method !== undefined && request.method !== 'GET') {
      throw new Error('Prototype MockTransport only supports registered mock operations.')
    }

    await waitForMockLatency()

    if (request.path === '/competitions?scenario=error') {
      throw new Error('The prototype competition feed is unavailable.')
    }

    if (request.path === '/competitions') {
      return mockCompetitions.map((competition) => ({ ...competition })) as T
    }

    const competitionRecruitmentMatch = request.path.match(
      /^\/competitions\/([^/]+)\/recruitments$/,
    )
    if (competitionRecruitmentMatch) {
      const competitionId = competitionRecruitmentMatch[1]
      return mockRecruitments
        .filter(
          (recruitment) =>
            recruitment.competitionId === competitionId && recruitment.isPubliclyListed,
        )
        .map(cloneRecruitment) as T
    }

    const competitionMatch = request.path.match(/^\/competitions\/([^/]+)$/)
    if (competitionMatch) {
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
    if (recruitmentMatch) {
      const recruitment = mockRecruitments.find((item) => item.id === recruitmentMatch[1])
      if (!recruitment) throw new Error('Recruitment not found.')
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
