import { mockCompetitions } from '@codestrike/contracts/mock'
import type { ApiRequest, ApiTransport } from './transport'

export class MockTransport implements ApiTransport {
  async request<T>(request: ApiRequest): Promise<T> {
    if (request.method !== undefined && request.method !== 'GET') throw new Error('Phase 1 MockTransport only supports registered mock operations.')
    if (request.path === '/competitions') {
      return mockCompetitions.map((competition) => ({ ...competition })) as T
    }
    throw new Error(`No mock registered for ${request.path}`)
  }
}
