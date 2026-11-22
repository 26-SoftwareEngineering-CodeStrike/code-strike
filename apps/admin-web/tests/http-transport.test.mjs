import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '@codestrike/contracts/http'
import { createAdminApiClient } from '../src/api/client.ts'
import { createAdminHttpTransport, createFetchAdapter } from '../src/api/http-transport.ts'
import { toElementFeedback } from '../src/api/error-feedback.ts'

function stubFetch(handler) {
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init })
    const result = handler(url, init) ?? {}
    const status = result.status ?? 200
    const body = result.body ?? ''
    const headers = result.headers ?? { 'content-type': 'application/json' }
    return new Response(body, { status, headers })
  }
  return {
    calls,
    restore() {
      globalThis.fetch = original
    },
  }
}

test('the fetch adapter sends the bearer token, the JSON body and the configured headers', async () => {
  const stub = stubFetch(() => ({ status: 200, body: JSON.stringify({ ok: true }) }))
  try {
    const transport = createAdminHttpTransport({
      baseUrl: 'http://127.0.0.1:8000/api/v1',
      adapter: createFetchAdapter(),
      getToken: () => 'admin-token',
    })

    const result = await transport.request({
      path: '/moderation/recruitments',
      method: 'POST',
      body: { decision: 'Approved' },
    })

    assert.deepEqual(result, { ok: true })
    assert.equal(stub.calls[0].url, 'http://127.0.0.1:8000/api/v1/moderation/recruitments')
    assert.equal(stub.calls[0].init.method, 'POST')
    assert.equal(stub.calls[0].init.headers.Authorization, 'Bearer admin-token')
    assert.equal(stub.calls[0].init.headers['Content-Type'], 'application/json')
    assert.equal(stub.calls[0].init.body, JSON.stringify({ decision: 'Approved' }))
  } finally {
    stub.restore()
  }
})

test('no Authorization header is sent when the admin has no session', async () => {
  const stub = stubFetch(() => ({ status: 200, body: '{}' }))
  try {
    const transport = createAdminHttpTransport({
      baseUrl: 'http://127.0.0.1:8000/api/v1',
      adapter: createFetchAdapter(),
      getToken: () => null,
    })

    await transport.request({ path: '/dashboard' })

    assert.equal('Authorization' in stub.calls[0].init.headers, false)
  } finally {
    stub.restore()
  }
})

test('a backend error envelope is mapped onto the ApiError', async () => {
  const stub = stubFetch(() => ({
    status: 403,
    body: JSON.stringify({ code: 'FORBIDDEN', message: 'This operation is not permitted.' }),
  }))
  try {
    const transport = createAdminHttpTransport({
      baseUrl: 'http://127.0.0.1:8000/api/v1',
      adapter: createFetchAdapter(),
      getToken: () => 'admin-token',
    })

    await assert.rejects(
      () => transport.request({ path: '/dashboard' }),
      (error) => {
        assert.ok(error instanceof ApiError)
        assert.equal(error.status, 403)
        assert.equal(error.code, 'FORBIDDEN')
        assert.equal(error.message, 'This operation is not permitted.')
        assert.equal(error.isForbidden, true)
        return true
      },
    )
  } finally {
    stub.restore()
  }
})

test('an unreachable service becomes a network error', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => {
    throw new TypeError('fetch failed')
  }
  try {
    const transport = createAdminHttpTransport({
      baseUrl: 'http://127.0.0.1:8000/api/v1',
      adapter: createFetchAdapter(),
    })

    await assert.rejects(
      () => transport.request({ path: '/dashboard' }),
      (error) => {
        assert.ok(error instanceof ApiError)
        assert.equal(error.kind, 'network')
        assert.equal(error.code, 'NETWORK_ERROR')
        return true
      },
    )
  } finally {
    globalThis.fetch = original
  }
})

test('the admin dashboard is served by the mock transport in mock mode', async () => {
  const api = createAdminApiClient({ mode: 'mock' })

  const dashboard = await api.getDashboard()

  assert.equal(dashboard.competitionCount, 2)
  assert.equal(dashboard.pendingApplicationCount, 1)
  assert.equal(dashboard.activeTeamCount, 1)
  assert.equal(dashboard.competitions.length, 2)
  assert.equal(dashboard.competitions[0].coverTone, 'Cobalt')
})

test('the admin dashboard requires a token and adapts the backend DTO in API mode', async () => {
  const calls = []
  const transport = createAdminHttpTransport({
    baseUrl: 'http://127.0.0.1:8000/api/v1',
    adapter: async (request) => {
      calls.push(request)
      return {
        statusCode: 200,
        data: {
          competitionCount: 4,
          pendingApplicationCount: 2,
          activeTeamCount: 6,
          moderationCount: 1,
          competitions: [
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
        },
      }
    },
    getToken: () => 'admin-token',
  })
  const api = createAdminApiClient({ mode: 'api', transport })

  const dashboard = await api.getDashboard()

  assert.equal(calls[0].url, 'http://127.0.0.1:8000/api/v1/dashboard')
  assert.equal(calls[0].header.Authorization, 'Bearer admin-token')
  assert.equal(dashboard.competitionCount, 4)
  assert.equal(dashboard.competitions[0].id, 'competition-1')
  assert.equal(dashboard.competitions[0].eligibilitySummary, 'Open to enrolled university students.')
})

test('the admin dashboard is refused locally when no session exists', async () => {
  let called = false
  const transport = createAdminHttpTransport({
    baseUrl: 'http://127.0.0.1:8000/api/v1',
    adapter: async () => {
      called = true
      return { statusCode: 200, data: {} }
    },
    getToken: () => null,
  })
  const api = createAdminApiClient({ mode: 'api', transport })

  await assert.rejects(
    () => api.getDashboard(),
    (error) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.status, 401)
      assert.equal(error.code, 'UNAUTHENTICATED')
      return true
    },
  )
  assert.equal(called, false)
})

test('the Element Plus feedback names the failure and keeps the backend message', () => {
  assert.equal(toElementFeedback(new Error('plain failure')).type, 'error')
  assert.equal(toElementFeedback(new Error('plain failure')).message, 'plain failure')

  const unauthorized = new ApiError('Invalid or expired session.', {
    kind: 'http',
    status: 401,
    code: 'UNAUTHENTICATED',
  })
  const feedback = toElementFeedback(unauthorized)
  assert.equal(feedback.type, 'error')
  assert.equal(feedback.message, 'Sign in required. Invalid or expired session.')

  const timeout = new ApiError('The request timed out.', { kind: 'timeout', code: 'TIMEOUT' })
  assert.equal(toElementFeedback(timeout).type, 'warning')
})
