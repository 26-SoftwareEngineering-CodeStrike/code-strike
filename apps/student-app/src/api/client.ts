import type {
  CompetitionDetail,
  CompetitionSummary,
  ApplicationHistoryItem,
  CaptainPendingApplication,
  CreateTeamInput,
  ActiveMemberContact,
  MyTeamItem,
  MyTeamsView,
  MockCommandResult,
  PrototypeActor,
  RecruitmentDetail,
  RecruitmentManagementView,
  RecruitmentSettings,
  RecruitmentSummary,
  TeamOperationsView,
  PlannerView,
  PlannerViewMode,
  PlannerOccurrence,
  SchoolPeriod,
  CreateCourseInput,
  CreatePlannerItemInput,
  UpdateOccurrenceInput,
  CourseCreationResult,
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
  listCaptainApplications(teamId?: string): Promise<MockCommandResult<CaptainPendingApplication[]>>
  approveApplication(id: string): Promise<MockCommandResult>
  rejectApplication(id: string): Promise<MockCommandResult>
  createTeam(input: CreateTeamInput): Promise<MockCommandResult<MyTeamItem>>
  listMyTeams(): Promise<MockCommandResult<MyTeamsView>>
  getRecruitmentManagement(teamId: string): Promise<MockCommandResult<RecruitmentManagementView>>
  setRecruitmentSwitch(teamId: string, value: 'Open' | 'Closed'): Promise<MockCommandResult<RecruitmentManagementView>>
  submitRecruitmentRevision(teamId: string, input: RecruitmentSettings): Promise<MockCommandResult<RecruitmentManagementView>>
  moderateRecruitment(teamId: string, decision: 'Approve' | 'Reject'): Promise<MockCommandResult<RecruitmentManagementView>>
  getTeamOperations(teamId: string): Promise<MockCommandResult<TeamOperationsView>>
  getActiveMemberContacts(teamId: string): Promise<MockCommandResult<ActiveMemberContact[]>>
  leaveTeam(teamId: string): Promise<MockCommandResult>
  removeMember(teamId: string, membershipId: string): Promise<MockCommandResult>
  transferCaptain(teamId: string, membershipId: string): Promise<MockCommandResult>
  dissolveTeam(teamId: string): Promise<MockCommandResult>
  getPlannerView(date: string, mode: PlannerViewMode): Promise<MockCommandResult<PlannerView>>
  listSchoolPeriods(): Promise<SchoolPeriod[]>
  createCourse(input: CreateCourseInput): Promise<MockCommandResult<CourseCreationResult>>
  createPlannerItem(input: CreatePlannerItemInput): Promise<MockCommandResult<PlannerOccurrence[]>>
  getPlannerOccurrence(id: string): Promise<MockCommandResult<PlannerOccurrence>>
  updatePlannerOccurrence(id: string, input: UpdateOccurrenceInput): Promise<MockCommandResult<PlannerOccurrence>>
  deletePlannerOccurrence(id: string): Promise<MockCommandResult>
  togglePlannerTodo(id: string): Promise<MockCommandResult<PlannerOccurrence>>
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
    listCaptainApplications: (teamId) =>
      transport.request<MockCommandResult<CaptainPendingApplication[]>>({ path: teamId ? `/captain/teams/${teamId}/applications` : '/captain/applications' }),
    approveApplication: (id) =>
      transport.request<MockCommandResult>({ path: `/captain/applications/${id}/approve`, method: 'POST' }),
    rejectApplication: (id) =>
      transport.request<MockCommandResult>({ path: `/captain/applications/${id}/reject`, method: 'POST' }),
    createTeam: (input) =>
      transport.request<MockCommandResult<MyTeamItem>>({ path: '/teams', method: 'POST', body: input }),
    listMyTeams: () =>
      transport.request<MockCommandResult<MyTeamsView>>({ path: '/teams/mine' }),
    getRecruitmentManagement: (teamId) =>
      transport.request<MockCommandResult<RecruitmentManagementView>>({ path: `/teams/${teamId}/recruitment` }),
    setRecruitmentSwitch: (teamId, value) =>
      transport.request<MockCommandResult<RecruitmentManagementView>>({ path: `/teams/${teamId}/recruitment-switch`, method: 'PUT', body: { value } }),
    submitRecruitmentRevision: (teamId, input) =>
      transport.request<MockCommandResult<RecruitmentManagementView>>({ path: `/teams/${teamId}/recruitment-revision`, method: 'POST', body: input }),
    moderateRecruitment: (teamId, decision) =>
      transport.request<MockCommandResult<RecruitmentManagementView>>({ path: `/prototype/recruitment-reviews/${teamId}/moderate`, method: 'POST', body: { decision } }),
    getTeamOperations: (teamId) =>
      transport.request<MockCommandResult<TeamOperationsView>>({ path: `/teams/${teamId}/operations` }),
    getActiveMemberContacts: (teamId) =>
      transport.request<MockCommandResult<ActiveMemberContact[]>>({ path: `/teams/${teamId}/member-contacts` }),
    leaveTeam: (teamId) =>
      transport.request<MockCommandResult>({ path: `/teams/${teamId}/leave`, method: 'POST' }),
    removeMember: (teamId, membershipId) =>
      transport.request<MockCommandResult>({ path: `/teams/${teamId}/members/${membershipId}/remove`, method: 'POST' }),
    transferCaptain: (teamId, membershipId) =>
      transport.request<MockCommandResult>({ path: `/teams/${teamId}/captain/transfer`, method: 'POST', body: { membershipId } }),
    dissolveTeam: (teamId) =>
      transport.request<MockCommandResult>({ path: `/teams/${teamId}/dissolve`, method: 'POST' }),
    getPlannerView: (date, mode) =>
      transport.request<MockCommandResult<PlannerView>>({ path: `/planner/views/${mode}/${date}` }),
    listSchoolPeriods: () => transport.request<SchoolPeriod[]>({ path: '/planner/periods' }),
    createCourse: (input) => transport.request<MockCommandResult<CourseCreationResult>>({ path: '/planner/courses', method: 'POST', body: input }),
    createPlannerItem: (input) => transport.request<MockCommandResult<PlannerOccurrence[]>>({ path: '/planner/items', method: 'POST', body: input }),
    getPlannerOccurrence: (id) => transport.request<MockCommandResult<PlannerOccurrence>>({ path: `/planner/occurrences/${id}` }),
    updatePlannerOccurrence: (id, input) => transport.request<MockCommandResult<PlannerOccurrence>>({ path: `/planner/occurrences/${id}`, method: 'PUT', body: input }),
    deletePlannerOccurrence: (id) => transport.request<MockCommandResult>({ path: `/planner/occurrences/${id}`, method: 'DELETE' }),
    togglePlannerTodo: (id) => transport.request<MockCommandResult<PlannerOccurrence>>({ path: `/planner/occurrences/${id}/complete`, method: 'POST' }),
  }
}
