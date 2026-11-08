import type { CompetitionSummary } from '@codestrike/contracts'
import { MockTransport } from './mock-transport'
import type { ApiTransport } from './transport'

export interface StudentApiClient { listCompetitions(): Promise<CompetitionSummary[]> }
export function createStudentApiClient(transport: ApiTransport = new MockTransport()): StudentApiClient {
  return { listCompetitions: () => transport.request<CompetitionSummary[]>({ path: '/competitions' }) }
}
