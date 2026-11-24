import type {
  ApiRequest,
  ApiTransport,
  AdminCompetitionFields,
  CompetitionDetailDto,
  DashboardData,
  DashboardDto,
  LoginRequest,
  TokenDto,
  TokenStore,
  TransportConfig,
  TransportMode,
  UserDto,
} from '@codestrike/contracts'
import { currentTransportConfig, toDashboard } from '@codestrike/contracts'
import { ApiError } from '@codestrike/contracts/http'
import { createAdminHttpTransport } from './http-transport'
import { MockTransport } from './mock-transport'
import { createAdminTokenStore } from './token-store'
import { createModerationApi } from './moderation'

export type CompetitionFields = AdminCompetitionFields
export type AdminApiClient = ReturnType<typeof createAdminApiClient>

export interface AdminApiClientOptions {
  transport?: ApiTransport
  mode?: TransportMode
  config?: TransportConfig
  tokenStore?: TokenStore
  onSessionChange?: (user: UserDto | null) => void
}

export function createAdminApiClient(options: AdminApiClientOptions = {}) {
  const config = options.config ?? currentTransportConfig()
  const mode = options.mode ?? config.mode
  const store = options.tokenStore ?? createAdminTokenStore()
  const transport =
    options.transport ??
    (mode === 'api'
      ? createAdminHttpTransport({
          baseUrl: config.baseUrl,
          timeout: config.timeout,
          getToken: () => store.get(),
        })
      : new MockTransport())

  let verified: { token: string; user: UserDto } | null = null

  function clear(token: string | null) {
    if (token !== store.get()) return
    store.clear()
    verified = null
    options.onSessionChange?.(null)
  }

  function accept(token: string, user: UserDto) {
    verified = { token, user }
    options.onSessionChange?.(user)
    return user
  }

  async function required<T>(request: ApiRequest): Promise<T> {
    const token = store.get()
    try {
      return await transport.request<T>({ ...request, auth: 'required' })
    } catch (error) {
      if (error instanceof ApiError && (error.isUnauthorized || error.isForbidden)) clear(token)
      throw error
    }
  }

  const adminOnly = () => new ApiError('An administrator account is required.', {
    kind: 'http', status: 403, code: 'FORBIDDEN',
  })

  return {
    mode,
    async signIn(credentials: LoginRequest) {
      const result = await transport.request<TokenDto>({ path: '/auth/login', method: 'POST', body: credentials })
      if (result.user.role !== 'Admin') {
        // Login issues a token to either role. Revoke the student token without persisting it.
        try {
          await transport.request({ path: '/auth/logout', method: 'POST',
            headers: { Authorization: 'Bearer ' + result.accessToken } })
        } finally {
          throw adminOnly()
        }
      }
      store.set(result.accessToken)
      return accept(result.accessToken, result.user)
    },
    async restoreSession() {
      const token = store.get()
      if (!token) return null
      if (verified?.token === token) return verified.user
      const user = await required<UserDto>({ path: '/auth/me' })
      if (token !== store.get()) return null
      if (user.role !== 'Admin') {
        clear(token)
        throw adminOnly()
      }
      return accept(token, user)
    },
    async signOut() {
      const token = store.get()
      try {
        if (token) await transport.request({ path: '/auth/logout', method: 'POST', auth: 'required' })
      } finally {
        clear(token)
      }
    },
    getDashboard: async (): Promise<DashboardData> => {
      if (mode !== 'api') {
        return transport.request<DashboardData>({ path: '/dashboard' })
      }
      const response = await required<DashboardDto>({ path: '/dashboard' })
      return toDashboard(response)
    },
    listCompetitions: (q: string, offset: number, limit: number) =>
      required<CompetitionDetailDto[]>({ path: '/admin/competitions', query: { q, offset, limit } }),
    createCompetition: (body: CompetitionFields) =>
      required<CompetitionDetailDto>({ path: '/competitions', method: 'POST', body }),
    updateCompetition: (id: string, body: Partial<CompetitionFields>) =>
      required<CompetitionDetailDto>({ path: '/competitions/' + encodeURIComponent(id), method: 'PATCH', body }),
    deleteCompetition: (id: string) =>
      required<void>({ path: '/competitions/' + encodeURIComponent(id), method: 'DELETE' }),
    ...createModerationApi(required),
  }
}
