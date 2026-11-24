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
  toActiveMemberContact,
  toApplicationHistoryItem,
  toCaptainPendingApplication,
  toCompetitionDetail,
  toCompetitionSummary,
  toMyTeamHistoryItem,
  toMyTeamItem,
  toRecruitmentDetail,
  toRecruitmentManagementView,
  toRecruitmentSummary,
  toTeamMemberView,
  toTeamOperationsView,
} from '@codestrike/contracts'
import type {
  ApplicationDto,
  CompetitionDetailDto,
  MemberDto,
  RecruitmentRevisionRowDto,
  ReviewDto,
  TeamCreatedDto,
  TeamDto,
  TeamHistoryDto,
} from '@codestrike/contracts'
import { ApiError } from '@codestrike/contracts/http'
import { createStudentHttpTransport } from './http-transport'
import { createCommunityApi } from './community'
import type { CommunityApi } from './community'
import { createNotificationsApi } from './notifications'
import type { NotificationsApi } from './notifications'
import { createPlannerApi, defaultApiSchoolPeriods } from './planner'
import { MockTransport } from './mock-transport'
import {
  applySession,
  applySessionUser,
  clearSession,
  hasStoredToken,
  sessionUser,
} from './session'
import { appTokenStore } from './token-store'

export interface StudentApiClient {
  readonly community: CommunityApi | null
  readonly notifications: NotificationsApi | null
  /**
   * False in API mode. The Prototype Lab switches local Mock personas only and
   * must never be presented as a way of obtaining a server-side identity.
   */
  readonly personaSwitchingAvailable: boolean
  listCompetitions(options?: { simulateFailure?: boolean; query?: string }): Promise<CompetitionSummary[]>
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
  removeMember(teamId: string, memberId: string): Promise<MockCommandResult>
  transferCaptain(teamId: string, memberId: string): Promise<MockCommandResult>
  dissolveTeam(teamId: string): Promise<MockCommandResult>
  getPlannerView(date: string, mode: PlannerViewMode): Promise<MockCommandResult<PlannerView>>
  listSchoolPeriods(): Promise<SchoolPeriod[]>
  createCourse(input: CreateCourseInput): Promise<MockCommandResult<CourseCreationResult>>
  createPlannerItem(input: CreatePlannerItemInput): Promise<MockCommandResult<PlannerOccurrence[]>>
  getPlannerOccurrence(id: string): Promise<MockCommandResult<PlannerOccurrence>>
  updatePlannerOccurrence(id: string, input: UpdateOccurrenceInput): Promise<MockCommandResult<PlannerOccurrence>>
  deletePlannerOccurrence(id: string): Promise<MockCommandResult>
  togglePlannerTodo(id: string, nextCompleted?: boolean): Promise<MockCommandResult<PlannerOccurrence>>
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

function toFailure<T>(error: unknown): MockCommandResult<T> {
  if (error instanceof ApiError) {
    // The backend reports the still-missing profile fields in `details`; the
    // screen shows them so the student knows what to complete.
    const missing = error.details?.missingFields
    const suffix =
      Array.isArray(missing) && missing.length > 0 ? ` Missing: ${missing.join(', ')}.` : ''
    return { ok: false, code: error.code, message: `${error.message}${suffix}` }
  }
  return {
    ok: false,
    code: 'UNEXPECTED_ERROR',
    message: error instanceof Error ? error.message : 'The request failed.',
  }
}

/**
 * API mode reports the server's verdict inside the envelope the screens
 * already render, so a refusal reaches the user with the backend's own code
 * and wording instead of a generic failure message.
 */
async function apiCommand<T>(
  run: () => Promise<T>,
  code: string,
  message: string,
): Promise<MockCommandResult<T>> {
  try {
    return { ok: true, code, message, data: await run() }
  } catch (error) {
    return toFailure<T>(error)
  }
}

/** The same envelope for an operation the server answers without a payload. */
async function apiCommandWithoutData(
  run: () => Promise<unknown>,
  code: string,
  message: string,
): Promise<MockCommandResult> {
  try {
    await run()
    return { ok: true, code, message }
  } catch (error) {
    return toFailure<undefined>(error)
  }
}

function buildStudentApiClient(transport: ApiTransport, mode: TransportMode): StudentApiClient {
  const api = mode === 'api'

  /**
   * The administrator skill catalog is the only source of the skill ids the
   * team endpoints accept. It is fetched once per client and reused.
   */
  let catalogPromise: Promise<SkillDto[]> | null = null
  const skillCatalog = (): Promise<SkillDto[]> => {
    if (!catalogPromise) {
      catalogPromise = transport.request<SkillDto[]>({ path: '/skills' }).catch((error) => {
        catalogPromise = null
        throw error
      })
    }
    return catalogPromise
  }

  const resolveSkillIds = async (skillNames: string[]): Promise<string[]> => {
    const catalog = await skillCatalog()
    const ids: string[] = []
    for (const name of skillNames) {
      const skill = catalog.find((item) => item.name === name)
      if (!skill) {
        throw new ApiError(`"${name}" is not in the administrator skill catalog.`, {
          kind: 'config',
          code: 'INVALID_SKILLS',
        })
      }
      ids.push(skill.id)
    }
    return ids
  }

  const competitionTitles = async (): Promise<Map<string, string>> => {
    const competitions = await transport.request<CompetitionDetailDto[]>({ path: '/competitions' })
    return new Map(competitions.map((competition) => [competition.id, competition.title]))
  }

  const signedInUser = async (): Promise<UserDto> => {
    if (sessionUser.value) return sessionUser.value
    const user = await transport.request<UserDto>({ path: '/auth/me', auth: 'required' })
    applySessionUser(user)
    return user
  }

  /** Reads the team, its competition and its revision list in one place. */
  const readRecruitmentManagement = async (
    teamId: string,
  ): Promise<RecruitmentManagementView> => {
    const team = await transport.request<TeamDto>({ path: `/teams/${teamId}`, auth: 'required' })
    const [competition, revisions, catalog] = await Promise.all([
      transport.request<CompetitionDetailDto>({ path: `/competitions/${team.competitionId}` }),
      transport.request<RecruitmentRevisionRowDto[]>({
        path: `/teams/${teamId}/recruitment/revisions`,
        auth: 'required',
      }),
      skillCatalog(),
    ])
    const skillNames = new Map(catalog.map((skill) => [skill.id, skill.name]))
    return toRecruitmentManagementView({
      team,
      competitionTitle: competition.title,
      competitionMaximumTeamSize: competition.maxTeamSize,
      revisions,
      resolveSkillName: (skillId) => skillNames.get(skillId) ?? skillId,
    })
  }

  const planner = api ? createPlannerApi(transport) : null

  return {
    personaSwitchingAvailable: !api,
    community: api ? createCommunityApi(transport) : null,
    notifications: api ? createNotificationsApi(transport) : null,
    listCompetitions: async (options) => {
      if (!api) {
        return transport.request<CompetitionSummary[]>({
          path: options?.simulateFailure ? '/competitions?scenario=error' : '/competitions',
        })
      }
      const query = options?.query?.trim()
      const response = await transport.request<CompetitionDetailDto[]>({
        path: '/competitions',
        query: query ? { q: query, limit: 100 } : { limit: 100 },
      })
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
        auth: 'optional',
      })
      const context = { deadlinePassed: competition.deadlineStatus === 'AfterDeadline' }
      return teams.map((team) => toRecruitmentSummary(team, context))
    },
    getRecruitment: async (id) => {
      if (!api) {
        return transport.request<RecruitmentDetail>({ path: `/recruitments/${id}` })
      }
      const team = await transport.request<TeamDto>({ path: `/teams/${id}`, auth: 'optional' })
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
    listMyApplications: async () => {
      if (!api) {
        return transport.request<MockCommandResult<ApplicationHistoryItem[]>>({
          path: '/applications/mine',
        })
      }
      return apiCommand(
        async () => {
          const [applications, teams, titles] = await Promise.all([
            transport.request<ApplicationDto[]>({ path: '/me/applications', auth: 'required' }),
            transport.request<TeamDto[]>({ path: '/me/teams', auth: 'required' }),
            competitionTitles(),
          ])
          const currentTeamIds = new Set(teams.map((team) => team.id))
          return applications.map((application) => {
            const isCurrentMembership = currentTeamIds.has(application.teamId)
            const canWithdraw = application.status === 'Pending' && !isCurrentMembership
            const canReapply =
              !isCurrentMembership &&
              !canWithdraw &&
              (application.status === 'Rejected' ||
                application.status === 'Withdrawn' ||
                application.status === 'Invalidated')
            return toApplicationHistoryItem(application, {
              competitionTitle: titles.get(application.competitionId) ?? '',
              isCurrentMembership,
              canWithdraw,
              canReapply,
            })
          })
        },
        'APPLICATION_HISTORY',
        'Owner application history loaded.',
      )
    },
    applyToTeam: async (teamId) => {
      if (!api) {
        return transport.request<MockCommandResult<ApplicationHistoryItem>>({
          path: '/applications',
          method: 'POST',
          body: { teamId },
        })
      }
      return apiCommand(
        async () => {
          const application = await transport.request<ApplicationDto>({
            path: `/teams/${teamId}/applications`,
            method: 'POST',
            auth: 'required',
          })
          const titles = await competitionTitles()
          return toApplicationHistoryItem(application, {
            competitionTitle: titles.get(application.competitionId) ?? '',
            isCurrentMembership: false,
            canWithdraw: application.status === 'Pending',
            canReapply: false,
          })
        },
        'APPLICATION_CREATED',
        'Application submitted with Pending status.',
      )
    },
    withdrawApplication: async (id) => {
      if (!api) {
        return transport.request<MockCommandResult>({
          path: `/applications/${id}/withdraw`,
          method: 'POST',
        })
      }
      return apiCommandWithoutData(
        async () => {
          await transport.request<ApplicationDto>({
            path: `/applications/${id}/withdraw`,
            method: 'POST',
            auth: 'required',
          })
        },
        'APPLICATION_WITHDRAWN',
        'Application withdrawn. The history record was preserved.',
      )
    },
    reapply: async (id) => {
      if (!api) {
        return transport.request<MockCommandResult<ApplicationHistoryItem>>({
          path: `/applications/${id}/reapply`,
          method: 'POST',
        })
      }
      return apiCommand(
        async () => {
          const history = await transport.request<ApplicationDto[]>({
            path: '/me/applications',
            auth: 'required',
          })
          const previous = history.find((application) => application.id === id)
          if (!previous) {
            throw new ApiError('The application history record was not found.', {
              kind: 'config',
              code: 'NOT_FOUND',
            })
          }
          const application = await transport.request<ApplicationDto>({
            path: `/teams/${previous.teamId}/applications`,
            method: 'POST',
            auth: 'required',
          })
          const titles = await competitionTitles()
          return toApplicationHistoryItem(application, {
            competitionTitle: titles.get(application.competitionId) ?? '',
            isCurrentMembership: false,
            canWithdraw: application.status === 'Pending',
            canReapply: false,
          })
        },
        'APPLICATION_CREATED',
        'A new application was created with Pending status.',
      )
    },
    listCaptainApplications: async (teamId) => {
      if (!api) {
        return transport.request<MockCommandResult<CaptainPendingApplication[]>>({
          path: teamId ? `/captain/teams/${teamId}/applications` : '/captain/applications',
        })
      }
      if (!teamId) {
        return {
          ok: false,
          code: 'TEAM_REQUIRED',
          message: 'Choose a team from My Teams before reviewing applications.',
        }
      }
      return apiCommand(
        async () => {
          const queue = await transport.request<ReviewDto[]>({
            path: `/teams/${teamId}/applications`,
            auth: 'required',
          })
          return queue.map((review) => toCaptainPendingApplication(review))
        },
        'CAPTAIN_QUEUE',
        'Pending application queue loaded.',
      )
    },
    approveApplication: async (id) => {
      if (!api) {
        return transport.request<MockCommandResult>({
          path: `/captain/applications/${id}/approve`,
          method: 'POST',
        })
      }
      return apiCommandWithoutData(
        async () => {
          await transport.request<ApplicationDto>({
            path: `/applications/${id}/decision`,
            method: 'POST',
            auth: 'required',
            body: { decision: 'Approved' },
          })
        },
        'APPLICATION_APPROVED',
        'Application approved; the applicant became an active member.',
      )
    },
    rejectApplication: async (id) => {
      if (!api) {
        return transport.request<MockCommandResult>({
          path: `/captain/applications/${id}/reject`,
          method: 'POST',
        })
      }
      return apiCommandWithoutData(
        async () => {
          await transport.request<ApplicationDto>({
            path: `/applications/${id}/decision`,
            method: 'POST',
            auth: 'required',
            body: { decision: 'Rejected' },
          })
        },
        'APPLICATION_REJECTED',
        'Application rejected; the history record was retained.',
      )
    },
    createTeam: async (input) => {
      if (!api) {
        return transport.request<MockCommandResult<MyTeamItem>>({
          path: '/teams',
          method: 'POST',
          body: input,
        })
      }
      return apiCommand(
        async () => {
          const skillIds = await resolveSkillIds(input.requiredSkills)
          const created = await transport.request<TeamCreatedDto>({
            path: '/teams',
            method: 'POST',
            auth: 'required',
            body: {
              competitionId: input.competitionId,
              name: input.name,
              summary: input.summary,
              capacity: input.capacity,
              skillIds,
              submitRecruitment: input.submitRecruitment,
            },
          })
          const titles = await competitionTitles()
          const [members] = await Promise.all([
            transport.request<MemberDto[]>({
              path: `/teams/${created.id}/members`,
              auth: 'required',
            }),
          ])
          const user = await signedInUser()
          const membership = members.find((member) => member.userId === user.id)
          if (!membership) {
            throw new ApiError('The new team membership was not returned by the server.', {
              kind: 'config',
              code: 'MEMBERSHIP_NOT_FOUND',
            })
          }
          return toMyTeamItem(created, {
            competitionTitle: titles.get(created.competitionId) ?? '',
            membershipId: membership.id,
            membershipStatus: 'Active',
            membershipRole: membership.role,
          })
        },
        'TEAM_CREATED',
        input.submitRecruitment
          ? 'Team created. The first recruitment version was submitted for review.'
          : 'Team created privately. No recruitment was submitted.',
      )
    },
    listMyTeams: async () => {
      if (!api) {
        return transport.request<MockCommandResult<MyTeamsView>>({ path: '/teams/mine' })
      }
      return apiCommand(
        async () => {
          const [teams, history, titles, user] = await Promise.all([
            transport.request<TeamDto[]>({ path: '/me/teams', auth: 'required' }),
            transport.request<TeamHistoryDto[]>({ path: '/me/team-history', auth: 'required' }),
            competitionTitles(),
            signedInUser(),
          ])
          const current: MyTeamItem[] = []
          for (const team of teams) {
            const members = await transport.request<MemberDto[]>({
              path: `/teams/${team.id}/members`,
              auth: 'required',
            })
            const membership = members.find((member) => member.userId === user.id)
            if (!membership) {
              throw new ApiError('The team membership was not returned by the server.', {
                kind: 'config',
                code: 'MEMBERSHIP_NOT_FOUND',
              })
            }
            current.push(
              toMyTeamItem(team, {
                competitionTitle: titles.get(team.competitionId) ?? '',
                membershipId: membership.id,
                membershipStatus: 'Active',
                membershipRole: membership.role,
              }),
            )
          }
          const past = history
            .filter((row) => row.status === 'Ended')
            .map((row) =>
              toMyTeamHistoryItem(row, { competitionTitle: titles.get(row.competitionId) ?? '' }),
            )
          const view: MyTeamsView = { current, history: past }
          return view
        },
        'MY_TEAMS',
        'Team memberships loaded.',
      )
    },
    getRecruitmentManagement: async (teamId) => {
      if (!api) {
        return transport.request<MockCommandResult<RecruitmentManagementView>>({
          path: `/teams/${teamId}/recruitment`,
        })
      }
      return apiCommand(
        async () => readRecruitmentManagement(teamId),
        'RECRUITMENT_MANAGEMENT',
        'Recruitment management loaded.',
      )
    },
    setRecruitmentSwitch: async (teamId, value) => {
      if (!api) {
        return transport.request<MockCommandResult<RecruitmentManagementView>>({
          path: `/teams/${teamId}/recruitment-switch`,
          method: 'PUT',
          body: { value },
        })
      }
      return apiCommand(
        async () => {
          await transport.request<TeamDto>({
            path: `/teams/${teamId}/recruitment/switch`,
            method: 'PUT',
            auth: 'required',
            body: { state: value },
          })
          return readRecruitmentManagement(teamId)
        },
        'RECRUITMENT_SWITCH_UPDATED',
        value === 'Open'
          ? 'Recruitment opened to new applications.'
          : 'Recruitment closed manually. Existing Pending applications stay reviewable.',
      )
    },
    submitRecruitmentRevision: async (teamId, input) => {
      if (!api) {
        return transport.request<MockCommandResult<RecruitmentManagementView>>({
          path: `/teams/${teamId}/recruitment-revision`,
          method: 'POST',
          body: input,
        })
      }
      return apiCommand(
        async () => {
          const skillIds = await resolveSkillIds(input.requiredSkills)
          await transport.request({
            path: `/teams/${teamId}/recruitment/revisions`,
            method: 'POST',
            auth: 'required',
            body: {
              name: input.teamName,
              summary: input.summary,
              capacity: input.capacity,
              skillIds,
            },
          })
          return readRecruitmentManagement(teamId)
        },
        'RECRUITMENT_SUBMITTED',
        'Recruitment version submitted for review. It stays private until it is approved.',
      )
    },
    moderateRecruitment: (teamId, decision) =>
      api
        ? unsupportedInApiMode('moderateRecruitment')
        : transport.request<MockCommandResult<RecruitmentManagementView>>({
            path: `/prototype/recruitment-reviews/${teamId}/moderate`,
            method: 'POST',
            body: { decision },
          }),
    getTeamOperations: async (teamId) => {
      if (!api) {
        return transport.request<MockCommandResult<TeamOperationsView>>({
          path: `/teams/${teamId}/operations`,
        })
      }
      return apiCommand(
        async () => {
          const [team, members, titles] = await Promise.all([
            transport.request<TeamDto>({ path: `/teams/${teamId}`, auth: 'required' }),
            transport.request<MemberDto[]>({
              path: `/teams/${teamId}/members`,
              auth: 'required',
            }),
            competitionTitles(),
          ])
          const user = await signedInUser()
          const membership = members.find((member) => member.userId === user.id)
          if (!membership) {
            throw new ApiError('The team membership was not returned by the server.', {
              kind: 'config',
              code: 'MEMBERSHIP_NOT_FOUND',
            })
          }
          const teamItem = toMyTeamItem(team, {
            competitionTitle: titles.get(team.competitionId) ?? '',
            membershipId: membership.id,
            membershipStatus: 'Active',
            membershipRole: membership.role,
          })
          return toTeamOperationsView(teamItem, members.map((member) => toTeamMemberView(member)))
        },
        'TEAM_OPERATIONS',
        'Active team members loaded without contact fields.',
      )
    },
    getActiveMemberContacts: async (teamId) => {
      if (!api) {
        return transport.request<MockCommandResult<ActiveMemberContact[]>>({
          path: `/teams/${teamId}/member-contacts`,
        })
      }
      return apiCommand(
        async () => {
          const members = await transport.request<MemberDto[]>({
            path: `/teams/${teamId}/members`,
            auth: 'required',
          })
          const contacts: ActiveMemberContact[] = []
          for (const member of members) {
            // The captain reads the contact details of the other members.
            if (member.role === 'Captain') continue
            const contact = await transport.request<{
              userId: string
              wechatId: string | null
              qqId: string | null
            }>({
              path: `/teams/${teamId}/members/${member.userId}/contact`,
              auth: 'required',
            })
            contacts.push(
              toActiveMemberContact(contact, {
                membershipId: member.userId,
                memberName: member.username,
              }),
            )
          }
          return contacts
        },
        'ACTIVE_MEMBER_CONTACTS',
        'Current active-member contacts loaded for the current captain.',
      )
    },
    leaveTeam: async (teamId) => {
      if (!api) {
        return transport.request<MockCommandResult>({
          path: `/teams/${teamId}/leave`,
          method: 'POST',
        })
      }
      return apiCommandWithoutData(
        async () => {
          await transport.request({ path: `/teams/${teamId}/leave`, method: 'POST', auth: 'required' })
        },
        'MEMBER_LEFT',
        'You left the team. The historical membership was retained.',
      )
    },
    removeMember: async (teamId, memberId) => {
      if (!api) {
        return transport.request<MockCommandResult>({
          path: `/teams/${teamId}/members/${memberId}/remove`,
          method: 'POST',
        })
      }
      return apiCommandWithoutData(
        async () => {
          await transport.request({
            path: `/teams/${teamId}/members/${memberId}`,
            method: 'DELETE',
            auth: 'required',
          })
        },
        'MEMBER_REMOVED',
        'Member removed. The historical membership was retained.',
      )
    },
    transferCaptain: async (teamId, memberId) => {
      if (!api) {
        return transport.request<MockCommandResult>({
          path: `/teams/${teamId}/captain/transfer`,
          method: 'POST',
          body: { membershipId: memberId },
        })
      }
      return apiCommandWithoutData(
        async () => {
          await transport.request({
            path: `/teams/${teamId}/captain`,
            method: 'POST',
            auth: 'required',
            body: { memberId },
          })
        },
        'CAPTAIN_TRANSFERRED',
        'Captaincy transferred immediately.',
      )
    },
    dissolveTeam: async (teamId) => {
      if (!api) {
        return transport.request<MockCommandResult>({
          path: `/teams/${teamId}/dissolve`,
          method: 'POST',
        })
      }
      return apiCommandWithoutData(
        async () => {
          await transport.request({
            path: `/teams/${teamId}/dissolve`,
            method: 'POST',
            auth: 'required',
          })
        },
        'TEAM_DISSOLVED',
        'Team dissolved. Pending applications were invalidated and history was retained.',
      )
    },
    getPlannerView: (date, mode) =>
      planner
        ? apiCommand(() => planner.view(date, mode), 'PLANNER_VIEW', 'Private planner loaded.')
        : transport.request<MockCommandResult<PlannerView>>({
            path: `/planner/views/${mode}/${date}`,
          }),
    listSchoolPeriods: () =>
      api
        ? Promise.resolve(defaultApiSchoolPeriods())
        : transport.request<SchoolPeriod[]>({ path: '/planner/periods' }),
    createCourse: async (input) => {
      if (!planner) {
        return transport.request<MockCommandResult<CourseCreationResult>>({
          path: '/planner/courses',
          method: 'POST',
          body: input,
        })
      }
      try {
        const result = await planner.createCourse(input)
        return {
          ok: true,
          code: 'COURSE_CREATED',
          message: `Created ${result.createdCount} occurrence(s); skipped ${result.skippedDuplicateCount} duplicate occurrence(s).`,
          data: result,
        }
      } catch (error) {
        return toFailure<CourseCreationResult>(error)
      }
    },
    createPlannerItem: async (input) => {
      if (!planner) {
        return transport.request<MockCommandResult<PlannerOccurrence[]>>({
          path: '/planner/items',
          method: 'POST',
          body: input,
        })
      }
      try {
        const items = await planner.createItem(input)
        return {
          ok: true,
          code: 'PLANNER_ITEM_CREATED',
          message: `Created ${items.length} ${input.type === 'TimedPlan' ? 'timed plan' : 'to-do'} occurrence(s).`,
          data: items,
        }
      } catch (error) {
        return toFailure<PlannerOccurrence[]>(error)
      }
    },
    getPlannerOccurrence: (id) =>
      planner
        ? apiCommand(() => planner.getOccurrence(id), 'PLANNER_OCCURRENCE', 'Occurrence loaded.')
        : transport.request<MockCommandResult<PlannerOccurrence>>({
            path: `/planner/occurrences/${id}`,
          }),
    updatePlannerOccurrence: (id, input) =>
      planner
        ? apiCommand(
            () => planner.updateOccurrence(id, input),
            'PLANNER_UPDATED',
            'Updated this occurrence only.',
          )
        : transport.request<MockCommandResult<PlannerOccurrence>>({
            path: `/planner/occurrences/${id}`,
            method: 'PUT',
            body: input,
          }),
    deletePlannerOccurrence: (id) =>
      planner
        ? apiCommandWithoutData(
            () => planner.deleteOccurrence(id),
            'PLANNER_DELETED',
            'Deleted this occurrence only.',
          )
        : transport.request<MockCommandResult>({
            path: `/planner/occurrences/${id}`,
            method: 'DELETE',
          }),
    togglePlannerTodo: async (id, nextCompleted) => {
      if (!planner) {
        return transport.request<MockCommandResult<PlannerOccurrence>>({
          path: `/planner/occurrences/${id}/complete`,
          method: 'POST',
        })
      }
      try {
        const updated = await planner.toggleTodo(id, nextCompleted)
        return {
          ok: true,
          code: 'PLANNER_TODO_UPDATED',
          message: updated.completed ? 'Marked to-do as completed.' : 'Marked to-do as not completed.',
          data: updated,
        }
      } catch (error) {
        return toFailure<PlannerOccurrence>(error)
      }
    },
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
