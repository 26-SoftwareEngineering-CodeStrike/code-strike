import type {
  CompetitionDetail,
  CompetitionSummary,
  RecruitmentDetail,
  RecruitmentSummary,
} from '@codestrike/contracts'
import { MockTransport } from './mock-transport'
import type { ApiTransport } from './transport'

export interface StudentApiClient {
  listCompetitions(options?: { simulateFailure?: boolean }): Promise<CompetitionSummary[]>
  getCompetition(id: string): Promise<CompetitionDetail>
  listRecruitments(competitionId: string): Promise<RecruitmentSummary[]>
  getRecruitment(id: string): Promise<RecruitmentDetail>
}

export function createStudentApiClient(transport: ApiTransport = new MockTransport()): StudentApiClient {
  return {
    listCompetitions: (options) =>
      transport.request<CompetitionSummary[]>({
        path: options?.simulateFailure ? '/competitions?scenario=error' : '/competitions',
      }),
    getCompetition: (id) =>
      transport.request<CompetitionDetail>({ path: `/competitions/${id}` }),
    listRecruitments: (competitionId) =>
      transport.request<RecruitmentSummary[]>({
        path: `/competitions/${competitionId}/recruitments`,
      }),
    getRecruitment: (id) =>
      transport.request<RecruitmentDetail>({ path: `/recruitments/${id}` }),
  }
}
