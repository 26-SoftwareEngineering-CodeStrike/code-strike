import { mockApplications, mockCompetitions, mockTeam } from '@codestrike/contracts/mock'
import type { ApiRequest, ApiTransport } from './transport'

const routes: Record<string, unknown> = {
  '/dashboard': {
    competitionCount: mockCompetitions.length,
    pendingApplicationCount: mockApplications.filter((item) => item.status === 'Pending').length,
    activeTeamCount: mockTeam.lifecycle === 'Active' ? 1 : 0,
    moderationCount: 3,
    competitions: mockCompetitions,
  },
}

export class MockTransport implements ApiTransport {
  async request<T>(request: ApiRequest): Promise<T> {
    const data = routes[request.path]
    if (data === undefined) throw new Error(`No mock registered for ${request.path}`)
    return JSON.parse(JSON.stringify(data)) as T
  }
}
