import type {
  CompetitionDetail,
  CompetitionSummary,
  ApplicationHistoryItem,
  CaptainPendingApplication,
  MockCommandResult,
  PrototypeActor,
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
  getRecruitmentDesignReview(id: string): Promise<RecruitmentDetail>
  listPrototypeActors(): Promise<PrototypeActor[]>
  getPrototypeActor(): Promise<PrototypeActor>
  selectPrototypeActor(actorId: string): Promise<MockCommandResult<PrototypeActor>>
  listMyApplications(): Promise<MockCommandResult<ApplicationHistoryItem[]>>
  applyToTeam(teamId: string): Promise<MockCommandResult<ApplicationHistoryItem>>
  withdrawApplication(id: string): Promise<MockCommandResult>
  reapply(id: string): Promise<MockCommandResult<ApplicationHistoryItem>>
  listCaptainApplications(): Promise<MockCommandResult<CaptainPendingApplication[]>>
  approveApplication(id: string): Promise<MockCommandResult>
  rejectApplication(id: string): Promise<MockCommandResult>
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
    getRecruitmentDesignReview: (id) =>
      transport.request<RecruitmentDetail>({ path: `/prototype/recruitment-reviews/${id}` }),
    listPrototypeActors: () =>
      transport.request<PrototypeActor[]>({ path: '/prototype/actors' }),
    getPrototypeActor: () =>
      transport.request<PrototypeActor>({ path: '/prototype/actor' }),
    selectPrototypeActor: (actorId) =>
      transport.request<MockCommandResult<PrototypeActor>>({
        path: '/prototype/actor', method: 'POST', body: { actorId },
      }),
    listMyApplications: () =>
      transport.request<MockCommandResult<ApplicationHistoryItem[]>>({ path: '/applications/mine' }),
    applyToTeam: (teamId) =>
      transport.request<MockCommandResult<ApplicationHistoryItem>>({ path: '/applications', method: 'POST', body: { teamId } }),
    withdrawApplication: (id) =>
      transport.request<MockCommandResult>({ path: `/applications/${id}/withdraw`, method: 'POST' }),
    reapply: (id) =>
      transport.request<MockCommandResult<ApplicationHistoryItem>>({ path: `/applications/${id}/reapply`, method: 'POST' }),
    listCaptainApplications: () =>
      transport.request<MockCommandResult<CaptainPendingApplication[]>>({ path: '/captain/applications' }),
    approveApplication: (id) =>
      transport.request<MockCommandResult>({ path: `/captain/applications/${id}/approve`, method: 'POST' }),
    rejectApplication: (id) =>
      transport.request<MockCommandResult>({ path: `/captain/applications/${id}/reject`, method: 'POST' }),
  }
}
