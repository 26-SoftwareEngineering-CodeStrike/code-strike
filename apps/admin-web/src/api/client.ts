import type { CompetitionSummary } from '@codestrike/contracts'
import { MockTransport } from './mock-transport'
import type { ApiTransport } from './transport'

export interface DashboardData {
  competitionCount: number
  pendingApplicationCount: number
  activeTeamCount: number
  moderationCount: number
  competitions: CompetitionSummary[]
}

export function createAdminApiClient(transport: ApiTransport = new MockTransport()) {
  return { getDashboard: () => transport.request<DashboardData>({ path: '/dashboard' }) }
}
