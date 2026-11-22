import type {
  ApiTransport,
  DashboardData,
  DashboardDto,
  TransportConfig,
  TransportMode,
} from '@codestrike/contracts'
import { currentTransportConfig, toDashboard } from '@codestrike/contracts'
import { createAdminHttpTransport } from './http-transport'
import { MockTransport } from './mock-transport'
import { createAdminTokenStore } from './token-store'

export interface AdminApiClient {
  getDashboard(): Promise<DashboardData>
}

export interface AdminApiClientOptions {
  transport?: ApiTransport
  mode?: TransportMode
  config?: TransportConfig
}

export function createAdminApiClient(options: AdminApiClientOptions = {}): AdminApiClient {
  const config = options.config ?? currentTransportConfig()
  const mode = options.mode ?? config.mode
  const transport =
    options.transport ??
    (mode === 'api'
      ? createAdminHttpTransport({
          baseUrl: config.baseUrl,
          timeout: config.timeout,
          tokenStore: createAdminTokenStore(),
        })
      : new MockTransport())

  return {
    getDashboard: async () => {
      if (mode !== 'api') {
        return transport.request<DashboardData>({ path: '/dashboard' })
      }
      const response = await transport.request<DashboardDto>({
        path: '/dashboard',
        auth: 'required',
      })
      return toDashboard(response)
    },
  }
}
