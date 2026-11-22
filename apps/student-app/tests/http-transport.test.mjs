import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError, HttpTransport } from '@codestrike/contracts/http'
import { createStudentHttpTransport } from '../src/api/http-transport.ts'

function scriptedAdapter(script) {
  const calls = []
  const adapter = async (request) => {
    calls.push(request)
    const step = script(request, calls.length)
    if (step instanceof Error) throw step
    return step
  }
  return { adapter, calls }
}

function ok(data) {
  return { statusCode: 200, data }
}

test('a successful GET targets the configured base URL and returns the parsed body', async () => {
  const { adapter, calls } = scriptedAdapter(() => ok({ status: 'ok' }))
  const transport = new HttpTransport({ baseUrl: 'http://127.0.0.1:8000/api/v1/', adapter })

  const result = await transport.request({ path: '/health' })

  assert.deepEqual(result, { status: 'ok' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'http://127.0.0.1:8000/api/v1/health')
  assert.equal(calls[0].method, 'GET')
  assert.equal(calls[0].header.Accept, 'application/json')
})

test('the bearer token is attached to every request once a session exists', async () => {
  const { adapter, calls } = scriptedAdapter(() => ok({ ok: true }))
  const transport = new HttpTransport({
    baseUrl: 'http://127.0.0.1:8000/api/v1',
    adapter,
    getToken: () => 'session-token-value',
  })

  await transport.request({ path: '/me' })

  assert.equal(calls[0].header.Authorization, 'Bearer session-token-value')
})

test('no Authorization header is sent when no token is available', async () => {
  const { adapter, calls } = scriptedAdapter(() => ok({ ok: true }))
  const transport = new HttpTransport({
    baseUrl: 'http://127.0.0.1:8000/api/v1',
    adapter,
    getToken: () => null,
  })

  await transport.request({ path: '/health' })

  assert.equal('Authorization' in calls[0].header, false)
})

test('a request that requires authentication never reaches the server without a token', async () => {
  const { adapter, calls } = scriptedAdapter(() => ok({ ok: true }))
  const transport = new HttpTransport({
    baseUrl: 'http://127.0.0.1:8000/api/v1',
    adapter,
    getToken: () => null,
  })

  await assert.rejects(
    () => transport.request({ path: '/dashboard', auth: 'required' }),
    (error) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.status, 401)
      assert.equal(error.code, 'UNAUTHENTICATED')
      assert.equal(error.isUnauthorized, true)
      return true
    },
  )
  assert.equal(calls.length, 0)
})

test('the backend error envelope is mapped onto the ApiError', async () => {
  const { adapter } = scriptedAdapter(() => ({
    statusCode: 409,
    data: { code: 'MEMBERSHIP_EXISTS', message: 'You already belong to a team.', details: { teamId: 'team-1' } },
  }))
  const transport = new HttpTransport({ baseUrl: 'http://127.0.0.1:8000/api/v1', adapter })

  await assert.rejects(
    () => transport.request({ path: '/teams', method: 'POST', body: {} }),
    (error) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.status, 409)
      assert.equal(error.code, 'MEMBERSHIP_EXISTS')
      assert.equal(error.message, 'You already belong to a team.')
      assert.deepEqual(error.details, { teamId: 'team-1' })
      assert.equal(error.isConflict, true)
      assert.deepEqual(error.toPayload(), {
        code: 'MEMBERSHIP_EXISTS',
        message: 'You already belong to a team.',
        details: { teamId: 'team-1' },
      })
      return true
    },
  )
})

test('the documented status codes map onto their backend codes', async () => {
  const expectations = [
    [401, 'UNAUTHENTICATED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [422, 'VALIDATION_ERROR'],
    [503, 'SERVICE_UNAVAILABLE'],
  ]

  for (const [status, code] of expectations) {
    const { adapter } = scriptedAdapter(() => ({ statusCode: status, data: { detail: 'raw detail' } }))
    const transport = new HttpTransport({ baseUrl: 'http://127.0.0.1:8000/api/v1', adapter })

    await assert.rejects(
      () => transport.request({ path: '/resource' }),
      (error) => {
        assert.ok(error instanceof ApiError, `expected an ApiError for status ${status}`)
        assert.equal(error.status, status)
        assert.equal(error.code, code)
        assert.equal(error.kind, 'http')
        return true
      },
    )
  }
})

test('an unreachable service becomes a network error and a slow service becomes a timeout', async () => {
  const failing = scriptedAdapter(() => new Error('request:fail'))
  const transport = new HttpTransport({
    baseUrl: 'http://127.0.0.1:8000/api/v1',
    adapter: failing.adapter,
  })

  await assert.rejects(
    () => transport.request({ path: '/health' }),
    (error) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.kind, 'network')
      assert.equal(error.code, 'NETWORK_ERROR')
      assert.equal(error.isRetryable, true)
      return true
    },
  )

  const slow = scriptedAdapter(() => new Error('request:fail timeout'))
  const timeoutTransport = new HttpTransport({
    baseUrl: 'http://127.0.0.1:8000/api/v1',
    adapter: slow.adapter,
  })

  await assert.rejects(
    () => timeoutTransport.request({ path: '/health' }),
    (error) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.kind, 'timeout')
      assert.equal(error.code, 'TIMEOUT')
      assert.equal(error.isRetryable, true)
      return true
    },
  )
})

test('a JSON body is sent with the JSON content type and query parameters are encoded', async () => {
  const { adapter, calls } = scriptedAdapter(() => ok({ id: 'team-1' }))
  const transport = new HttpTransport({ baseUrl: 'http://127.0.0.1:8000/api/v1', adapter })

  await transport.request({
    path: '/competitions',
    method: 'POST',
    body: { name: 'Team Alpha', capacity: 4 },
    query: { q: 'design contest', limit: 20, skip: undefined },
  })

  assert.equal(calls[0].url, 'http://127.0.0.1:8000/api/v1/competitions?q=design%20contest&limit=20')
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].header['Content-Type'], 'application/json')
  assert.deepEqual(calls[0].data, { name: 'Team Alpha', capacity: 4 })
})

test('a 401 response drops the stale token through the unauthorized handler', async () => {
  const { adapter } = scriptedAdapter(() => ({
    statusCode: 401,
    data: { code: 'UNAUTHENTICATED', message: 'Invalid or expired session.' },
  }))
  const cleared = []
  const transport = new HttpTransport({
    baseUrl: 'http://127.0.0.1:8000/api/v1',
    adapter,
    getToken: () => 'expired-token',
    onUnauthorized: () => cleared.push(true),
  })

  await assert.rejects(() => transport.request({ path: '/me' }))

  assert.equal(cleared.length, 1)
})

test('the student transport reads the bearer token from its token store', async () => {
  const { adapter, calls } = scriptedAdapter(() => ok({ ok: true }))
  const stored = { token: 'stored-token' }
  const transport = createStudentHttpTransport({
    baseUrl: 'http://127.0.0.1:8000/api/v1',
    adapter,
    tokenStore: {
      get: () => stored.token,
      set: (token) => {
        stored.token = token
      },
      clear: () => {
        stored.token = ''
      },
    },
  })

  await transport.request({ path: '/me' })

  assert.equal(calls[0].header.Authorization, 'Bearer stored-token')
})
