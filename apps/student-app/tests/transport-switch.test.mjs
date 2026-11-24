import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveTransportConfig } from '@codestrike/contracts'
import { ApiError } from '@codestrike/contracts/http'
import { createStudentApiClient } from '../src/api/client.ts'

function recordingTransport(responses) {
  const calls = []
  return {
    calls,
    async request(request) {
      calls.push(request)
      const path = request.path
      const responder = responses[path]
      if (!responder) throw new Error(`Unexpected request to ${path}`)
      return responder(request)
    },
  }
}

test('the transport mode is driven by environment configuration', () => {
  assert.equal(resolveTransportConfig({}).mode, 'mock')
  assert.equal(resolveTransportConfig({ VITE_USE_MOCK: 'true' }).mode, 'mock')
  assert.equal(resolveTransportConfig({ VITE_USE_MOCK: 'false' }).mode, 'api')
  assert.equal(resolveTransportConfig({ VITE_USE_MOCK: '0' }).mode, 'api')
  assert.equal(resolveTransportConfig({ VITE_USE_MOCK: '1' }).mode, 'mock')
})

test('the API base URL and timeout come from the environment', () => {
  const config = resolveTransportConfig({
    VITE_USE_MOCK: 'false',
    VITE_API_BASE_URL: 'http://127.0.0.1:9000/api/v1/',
    VITE_API_TIMEOUT: '2500',
  })

  assert.equal(config.mode, 'api')
  assert.equal(config.baseUrl, 'http://127.0.0.1:9000/api/v1/')
  assert.equal(config.timeout, 2500)

  const fallback = resolveTransportConfig({ VITE_USE_MOCK: 'false' })
  assert.equal(fallback.baseUrl, 'http://127.0.0.1:8000/api/v1')
  assert.equal(fallback.timeout, 15000)
})

test('mock mode keeps serving the prototype operations unchanged', async () => {
  const api = createStudentApiClient({ mode: 'mock' })

  const competitions = await api.listCompetitions()
  assert.equal(competitions.length, 2)
  assert.equal(competitions[0].id, 'competition-demo-1')
  assert.equal(competitions[0].coverTone, 'Cobalt')

  const actors = await api.listPrototypeActors()
  assert.equal(actors.length > 0, true)

  const detail = await api.getCompetition('competition-demo-1')
  const recruitments = await api.listRecruitments('competition-demo-1')
  assert.equal(detail.community.publishedRecruitmentCount, recruitments.length)
})

test('mock mode still reports the simulated feed failure', async () => {
  const api = createStudentApiClient({ mode: 'mock' })

  await assert.rejects(() => api.listCompetitions({ simulateFailure: true }))
})

test('API mode calls the backend routes and returns adapted view models', async () => {
  const transport = recordingTransport({
    '/competitions': () => [
      {
        id: 'competition-1',
        title: '2026 University Innovation Challenge',
        category: 'Innovation',
        registrationDeadline: '2026-12-15T16:00:00Z',
        deadlineStatus: 'BeforeDeadline',
        description: 'A campus innovation challenge.',
        eligibilityRules: 'Open to enrolled university students.',
        maxTeamSize: 4,
        officialSourceUrl: 'https://example.edu/innovation-challenge',
        coverImage: null,
        published: true,
        communityId: 'community-1',
      },
    ],
  })
  const api = createStudentApiClient({ mode: 'api', transport })

  const competitions = await api.listCompetitions()

  assert.equal(transport.calls[0].path, '/competitions')
  assert.equal(transport.calls[0].method, undefined)
  assert.equal(competitions[0].id, 'competition-1')
  assert.equal(competitions[0].eligibilitySummary, 'Open to enrolled university students.')
})

test('API mode fills the competition detail from the backend routes', async () => {
  const competition = {
    id: 'competition-1',
    title: '2026 University Innovation Challenge',
    category: 'Innovation',
    registrationDeadline: '2026-12-15T16:00:00Z',
    deadlineStatus: 'BeforeDeadline',
    description: 'A campus innovation challenge.',
    eligibilityRules: 'Open to enrolled university students.',
    maxTeamSize: 4,
    officialSourceUrl: 'https://example.edu/innovation-challenge',
    coverImage: null,
    published: true,
    communityId: 'community-1',
  }
  const transport = recordingTransport({
    '/competitions/competition-1': () => competition,
    '/competitions/competition-1/recruitments': () => [],
  })
  const api = createStudentApiClient({ mode: 'api', transport })

  const detail = await api.getCompetition('competition-1')

  assert.deepEqual(
    transport.calls.map((call) => call.path),
    ['/competitions/competition-1', '/competitions/competition-1/recruitments'],
  )
  assert.equal(detail.maximumTeamSize, 4)
  assert.equal(detail.eligibility, 'Open to enrolled university students.')
  assert.equal(detail.community.publishedRecruitmentCount, 0)
})

test('API mode reports the prototype operations the backend does not serve', async () => {
  const api = createStudentApiClient({ mode: 'api', transport: recordingTransport({}) })

  // The team, application and planner screens are served by the backend since
  // T4/T7, so a refused request comes back as a failed envelope instead of a
  // config rejection.
  const history = await api.listMyApplications()
  assert.equal(history.ok, false)
  assert.equal(typeof history.message, 'string')

  const planner = await api.getPlannerView('2026-11-23', 'Day')
  assert.equal(planner.ok, false)
  assert.equal(typeof planner.message, 'string')

  for (const call of [
    () => api.listPrototypeActors(),
    () => api.getPrototypeActor(),
    () => api.selectPrototypeActor('visitor'),
    () => api.getRecruitmentDesignReview('team-alpha'),
    () => api.moderateRecruitment('team-alpha', 'Approve'),
  ]) {
    await assert.rejects(call, (error) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.code, 'NOT_AVAILABLE_IN_API_MODE')
      assert.equal(error.kind, 'config')
      return true
    })
  }
})

test('API mode never offers the Prototype Lab as an identity', async () => {
  const api = createStudentApiClient({ mode: 'api', transport: recordingTransport({}) })
  assert.equal(api.personaSwitchingAvailable, false)

  const mockApi = createStudentApiClient({ mode: 'mock' })
  assert.equal(mockApi.personaSwitchingAvailable, true)
})

test('mock mode reports that the account features need the API backend', async () => {
  const api = createStudentApiClient({ mode: 'mock' })

  for (const call of [
    () => api.login({ username: 'student', password: 'password-value' }),
    () => api.register({ username: 'student', password: 'password-value' }),
    () => api.getProfile(),
    () => api.listSkills(),
    () => api.logout(),
  ]) {
    await assert.rejects(call, (error) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.code, 'NOT_AVAILABLE_IN_MOCK_MODE')
      assert.equal(error.kind, 'config')
      return true
    })
  }
})

test('mock mode has no stored session to restore', async () => {
  const api = createStudentApiClient({ mode: 'mock' })

  assert.equal(await api.restoreSession(), null)
})
