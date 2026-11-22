import type {
  ActiveMemberContact,
  ApiTransport,
  ApplicationHistoryItem,
  CaptainPendingApplication,
  CompetitionDetail,
  CompetitionSummary,
  CreateCourseInput,
  CreatePlannerItemInput,
  CreateTeamInput,
  CourseCreationResult,
  MockCommandResult,
  MyTeamItem,
  MyTeamsView,
  PlannerOccurrence,
  PlannerView,
  PlannerViewMode,
  ProfileDto,
  ProfileUpdateRequest,
  PrototypeActor,
  RecruitmentDetail,
  RecruitmentManagementView,
  RecruitmentSettings,
  RecruitmentSummary,
  RegisterRequest,
  LoginRequest,
  SchoolPeriod,
  SkillDto,
  TeamOperationsView,
  TokenDto,
  TransportConfig,
  TransportMode,
  UpdateOccurrenceInput,
  UserDto,
} from '@codestrike/contracts'
import {
  currentTransportConfig,
  toCompetitionDetail,
  toCompetitionSummary,
  toRecruitmentDetail,
  toRecruitmentSummary,
} from '@codestrike/contracts'
import type { CompetitionDetailDto, TeamDto } from '@codestrike/contracts'
import { ApiError } from '@codestrike/contracts/http'
import { createStudentHttpTransport } from './http-transport'
import { MockTransport } from './mock-transport'
import {
  applySession,
  applySessionUser,
  clearSession,
  hasStoredToken,
} from './session'
import { appTokenStore } from './token-store'

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
  register(input: RegisterRequest): Promise<TokenDto>
  login(input: LoginRequest): Promise<TokenDto>
  logout(): Promise<void>
  restoreSession(): Promise<UserDto | null>
  getProfile(): Promise<ProfileDto>
  saveProfile(input: ProfileUpdateRequest): Promise<ProfileDto>
  listSkills(): Promise<SkillDto[]>
}

export interface StudentApiClientOptions {
  transport?: ApiTransport
  mode?: TransportMode
  config?: TransportConfig
}

export function createStudentApiClient(options: StudentApiClientOptions = {}): StudentApiClient {
  const config = options.config ?? currentTransportConfig()
  const mode = options.mode ?? config.mode
  const transport =
    options.transport ??
    (mode === 'api'
      ? createStudentHttpTransport({
          baseUrl: config.baseUrl,
          timeout: config.timeout,
          tokenStore: appTokenStore,
        })
      : new MockTransport())
  return buildStudentApiClient(transport, mode)
}

/**
 * The prototype operations below are served by the mock transport only. The
 * backend equivalents are delivered by the later sprint tasks, so API mode
 * reports them instead of calling an endpoint that does not exist.
 */
function unsupportedInApiMode<T>(operation: string): Promise<T> {
  return Promise.reject(
    new ApiError(`"${operation}" is a prototype operation and is not served by the API yet.`, {
      kind: 'config',
      code: 'NOT_AVAILABLE_IN_API_MODE',
    }),
  )
}

/**
 * The account and profile screens talk to the real backend, so they need the
 * API transport. Mock mode reports that instead of pretending to sign in.
 */
function needsApiBackend<T>(operation: string): Promise<T> {
  return Promise.reject(
    new ApiError(
      `"${operation}" needs the CodeStrike API. Start the backend and set VITE_USE_MOCK=false to use accounts and profiles.`,
      { kind: 'config', code: 'NOT_AVAILABLE_IN_MOCK_MODE' },
    ),
  )
}

function buildStudentApiClient(transport: ApiTransport, mode: TransportMode): StudentApiClient {
  const api = mode === 'api'

  return {
    listCompetitions: async (options) => {
      if (!api) {
        return transport.request<CompetitionSummary[]>({
          path: options?.simulateFailure ? '/competitions?scenario=error' : '/competitions',
        })
      }
      const response = await transport.request<CompetitionDetailDto[]>({ path: '/competitions' })
      return response.map((competition) => toCompetitionSummary(competition))
    },
    getCompetition: async (id) => {
      if (!api) {
        return transport.request<CompetitionDetail>({ path: `/competitions/${id}` })
      }
      const competition = await transport.request<CompetitionDetailDto>({
        path: `/competitions/${id}`,
      })
      const recruitments = await transport.request<TeamDto[]>({
        path: `/competitions/${id}/recruitments`,
      })
      return toCompetitionDetail(competition, {
        publishedRecruitmentCount: recruitments.length,
      })
    },
    listRecruitments: async (competitionId) => {
      if (!api) {
        return transport.request<RecruitmentSummary[]>({
          path: `/competitions/${competitionId}/recruitments`,
        })
      }
      const competition = await transport.request<CompetitionDetailDto>({
        path: `/competitions/${competitionId}`,
      })
      const teams = await transport.request<TeamDto[]>({
        path: `/competitions/${competitionId}/recruitments`,
      })
      const context = { deadlinePassed: competition.deadlineStatus === 'AfterDeadline' }
      return teams.map((team) => toRecruitmentSummary(team, context))
    },
    getRecruitment: async (id) => {
      if (!api) {
        return transport.request<RecruitmentDetail>({ path: `/recruitments/${id}` })
      }
      const team = await transport.request<TeamDto>({ path: `/teams/${id}` })
      const competition = await transport.request<CompetitionDetailDto>({
        path: `/competitions/${team.competitionId}`,
      })
      return toRecruitmentDetail(team, {
        competitionTitle: competition.title,
        competitionDeadline: competition.registrationDeadline,
        deadlinePassed: competition.deadlineStatus === 'AfterDeadline',
      })
    },
    getRecruitmentDesignReview: (id) =>
      api
        ? unsupportedInApiMode('getRecruitmentDesignReview')
        : transport.request<RecruitmentDetail>({ path: `/prototype/recruitment-reviews/${id}` }),
    listPrototypeActors: () =>
      api
        ? unsupportedInApiMode('listPrototypeActors')
        : transport.request<PrototypeActor[]>({ path: '/prototype/actors' }),
    getPrototypeActor: () =>
      api
        ? unsupportedInApiMode('getPrototypeActor')
        : transport.request<PrototypeActor>({ path: '/prototype/actor' }),
    selectPrototypeActor: (actorId) =>
      api
        ? unsupportedInApiMode('selectPrototypeActor')
        : transport.request<MockCommandResult<PrototypeActor>>({
            path: '/prototype/actor',
            method: 'POST',
            body: { actorId },
          }),
    listMyApplications: () =>
      api
        ? unsupportedInApiMode('listMyApplications')
        : transport.request<MockCommandResult<ApplicationHistoryItem[]>>({ path: '/applications/mine' }),
    applyToTeam: (teamId) =>
      api
        ? unsupportedInApiMode('applyToTeam')
        : transport.request<MockCommandResult<ApplicationHistoryItem>>({
            path: '/applications',
            method: 'POST',
            body: { teamId },
          }),
    withdrawApplication: (id) =>
      api
        ? unsupportedInApiMode('withdrawApplication')
        : transport.request<MockCommandResult>({ path: `/applications/${id}/withdraw`, method: 'POST' }),
    reapply: (id) =>
      api
        ? unsupportedInApiMode('reapply')
        : transport.request<MockCommandResult<ApplicationHistoryItem>>({
            path: `/applications/${id}/reapply`,
            method: 'POST',
          }),
    listCaptainApplications: (teamId) =>
      api
        ? unsupportedInApiMode('listCaptainApplications')
        : transport.request<MockCommandResult<CaptainPendingApplication[]>>({
            path: teamId ? `/captain/teams/${teamId}/applications` : '/captain/applications',
          }),
    approveApplication: (id) =>
      api
        ? unsupportedInApiMode('approveApplication')
        : transport.request<MockCommandResult>({
            path: `/captain/applications/${id}/approve`,
            method: 'POST',
          }),
    rejectApplication: (id) =>
      api
        ? unsupportedInApiMode('rejectApplication')
        : transport.request<MockCommandResult>({
            path: `/captain/applications/${id}/reject`,
            method: 'POST',
          }),
    createTeam: (input) =>
      api
        ? unsupportedInApiMode('createTeam')
        : transport.request<MockCommandResult<MyTeamItem>>({ path: '/teams', method: 'POST', body: input }),
    listMyTeams: () =>
      api
        ? unsupportedInApiMode('listMyTeams')
        : transport.request<MockCommandResult<MyTeamsView>>({ path: '/teams/mine' }),
    getRecruitmentManagement: (teamId) =>
      api
        ? unsupportedInApiMode('getRecruitmentManagement')
        : transport.request<MockCommandResult<RecruitmentManagementView>>({
            path: `/teams/${teamId}/recruitment`,
          }),
    setRecruitmentSwitch: (teamId, value) =>
      api
        ? unsupportedInApiMode('setRecruitmentSwitch')
        : transport.request<MockCommandResult<RecruitmentManagementView>>({
            path: `/teams/${teamId}/recruitment-switch`,
            method: 'PUT',
            body: { value },
          }),
    submitRecruitmentRevision: (teamId, input) =>
      api
        ? unsupportedInApiMode('submitRecruitmentRevision')
        : transport.request<MockCommandResult<RecruitmentManagementView>>({
            path: `/teams/${teamId}/recruitment-revision`,
            method: 'POST',
            body: input,
          }),
    moderateRecruitment: (teamId, decision) =>
      api
        ? unsupportedInApiMode('moderateRecruitment')
        : transport.request<MockCommandResult<RecruitmentManagementView>>({
            path: `/prototype/recruitment-reviews/${teamId}/moderate`,
            method: 'POST',
            body: { decision },
          }),
    getTeamOperations: (teamId) =>
      api
        ? unsupportedInApiMode('getTeamOperations')
        : transport.request<MockCommandResult<TeamOperationsView>>({
            path: `/teams/${teamId}/operations`,
          }),
    getActiveMemberContacts: (teamId) =>
      api
        ? unsupportedInApiMode('getActiveMemberContacts')
        : transport.request<MockCommandResult<ActiveMemberContact[]>>({
            path: `/teams/${teamId}/member-contacts`,
          }),
    leaveTeam: (teamId) =>
      api
        ? unsupportedInApiMode('leaveTeam')
        : transport.request<MockCommandResult>({ path: `/teams/${teamId}/leave`, method: 'POST' }),
    removeMember: (teamId, membershipId) =>
      api
        ? unsupportedInApiMode('removeMember')
        : transport.request<MockCommandResult>({
            path: `/teams/${teamId}/members/${membershipId}/remove`,
            method: 'POST',
          }),
    transferCaptain: (teamId, membershipId) =>
      api
        ? unsupportedInApiMode('transferCaptain')
        : transport.request<MockCommandResult>({
            path: `/teams/${teamId}/captain/transfer`,
            method: 'POST',
            body: { membershipId },
          }),
    dissolveTeam: (teamId) =>
      api
        ? unsupportedInApiMode('dissolveTeam')
        : transport.request<MockCommandResult>({ path: `/teams/${teamId}/dissolve`, method: 'POST' }),
    getPlannerView: (date, mode) =>
      api
        ? unsupportedInApiMode('getPlannerView')
        : transport.request<MockCommandResult<PlannerView>>({
            path: `/planner/views/${mode}/${date}`,
          }),
    listSchoolPeriods: () =>
      api
        ? unsupportedInApiMode('listSchoolPeriods')
        : transport.request<SchoolPeriod[]>({ path: '/planner/periods' }),
    createCourse: (input) =>
      api
        ? unsupportedInApiMode('createCourse')
        : transport.request<MockCommandResult<CourseCreationResult>>({
            path: '/planner/courses',
            method: 'POST',
            body: input,
          }),
    createPlannerItem: (input) =>
      api
        ? unsupportedInApiMode('createPlannerItem')
        : transport.request<MockCommandResult<PlannerOccurrence[]>>({
            path: '/planner/items',
            method: 'POST',
            body: input,
          }),
    getPlannerOccurrence: (id) =>
      api
        ? unsupportedInApiMode('getPlannerOccurrence')
        : transport.request<MockCommandResult<PlannerOccurrence>>({
            path: `/planner/occurrences/${id}`,
          }),
    updatePlannerOccurrence: (id, input) =>
      api
        ? unsupportedInApiMode('updatePlannerOccurrence')
        : transport.request<MockCommandResult<PlannerOccurrence>>({
            path: `/planner/occurrences/${id}`,
            method: 'PUT',
            body: input,
          }),
    deletePlannerOccurrence: (id) =>
      api
        ? unsupportedInApiMode('deletePlannerOccurrence')
        : transport.request<MockCommandResult>({
            path: `/planner/occurrences/${id}`,
            method: 'DELETE',
          }),
    togglePlannerTodo: (id) =>
      api
        ? unsupportedInApiMode('togglePlannerTodo')
        : transport.request<MockCommandResult<PlannerOccurrence>>({
            path: `/planner/occurrences/${id}/complete`,
            method: 'POST',
          }),
    register: async (input) => {
      if (!api) return needsApiBackend('register')
      const token = await transport.request<TokenDto>({
        path: '/auth/register',
        method: 'POST',
        body: input,
      })
      applySession(token)
      return token
    },
    login: async (input) => {
      if (!api) return needsApiBackend('login')
      const token = await transport.request<TokenDto>({
        path: '/auth/login',
        method: 'POST',
        body: input,
      })
      applySession(token)
      return token
    },
    logout: async () => {
      if (!api) return needsApiBackend('logout')
      try {
        await transport.request<{ message: string }>({ path: '/auth/logout', method: 'POST' })
      } catch (error) {
        // A session that is already gone is not a failure worth reporting.
        if (!(error instanceof ApiError && error.status === 401)) throw error
      } finally {
        clearSession()
      }
    },
    restoreSession: async () => {
      if (!api) return null
      if (!hasStoredToken()) return null
      try {
        const user = await transport.request<UserDto>({ path: '/auth/me', auth: 'required' })
        applySessionUser(user)
        return user
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearSession()
          return null
        }
        throw error
      }
    },
    getProfile: () => {
      if (!api) return needsApiBackend('getProfile')
      return transport.request<ProfileDto>({ path: '/profiles/me', auth: 'required' })
    },
    saveProfile: (input) => {
      if (!api) return needsApiBackend('saveProfile')
      return transport.request<ProfileDto>({
        path: '/profiles/me',
        method: 'PATCH',
        body: input,
        auth: 'required',
      })
    },
    listSkills: () => {
      if (!api) return needsApiBackend('listSkills')
      return transport.request<SkillDto[]>({ path: '/skills' })
    },
  }
}
