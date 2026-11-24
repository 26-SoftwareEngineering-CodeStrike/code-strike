import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '@codestrike/contracts/http'
import { createAdminApiClient } from '../src/api/client.ts'
import { createAdminHttpTransport } from '../src/api/http-transport.ts'

const admin = { id: 'a', username: 'reviewer', role: 'Admin', email: null }
const student = { ...admin, role: 'Student' }
const credentials = { username: 'reviewer', password: 'some password' }

function consoleClient(reply, initial = null) {
  let token = initial
  const calls = []
  const users = []
  const tokenStore = {
    get: () => token,
    set: (value) => { token = value },
    clear: () => { token = null },
  }
  const transport = {
    async request(request) {
      calls.push({ ...request, token })
      return reply(request, token)
    },
  }
  const api = createAdminApiClient({ mode: 'api', transport, tokenStore, onSessionChange: user => users.push(user) })
  return { api, tokenStore, calls, users }
}

test('sign-in accepts the backend Admin identity and server logout revokes the same token', async () => {
  const { api, calls, tokenStore, users } = consoleClient(() => ({ user: admin, accessToken: 'issued' }))
  assert.deepEqual(await api.signIn(credentials), admin)
  assert.equal(tokenStore.get(), 'issued')
  assert.deepEqual(calls[0].body, credentials)
  assert.equal(calls[0].path, '/auth/login')
  await api.signOut()
  assert.equal(calls[1].path, '/auth/logout')
  assert.equal(calls[1].method, 'POST')
  assert.equal(calls[1].token, 'issued')
  assert.equal(tokenStore.get(), null)
  assert.deepEqual(users, [admin, null])
})

test('a valid student login is revoked and never persisted as an admin session', async () => {
  const { api, calls, tokenStore, users } = consoleClient(() => ({ user: student, accessToken: 'student-token' }))
  await assert.rejects(api.signIn(credentials), /administrator/i)
  assert.equal(calls[1].path, '/auth/logout')
  assert.equal(calls[1].headers.Authorization, 'Bearer student-token')
  assert.equal(tokenStore.get(), null)
  assert.ok(users.every(user => user === null))
})

test('restoration verifies the stored token at /auth/me and invalidates a demoted user', async () => {
  for (const identity of [admin, student]) {
    const { api, calls, tokenStore } = consoleClient(() => identity, 'saved')
    if (identity.role === 'Admin') assert.deepEqual(await api.restoreSession(), admin)
    else await assert.rejects(api.restoreSession(), /administrator/i)
    assert.equal(calls[0].path, '/auth/me')
    assert.equal(calls[0].auth, 'required')
    assert.equal(tokenStore.get(), identity.role === 'Admin' ? 'saved' : null)
  }
})

test('a protected 401 or 403 ends the current session, and a transient failure can be retried', async () => {
  for (const status of [401, 403, 503]) {
    const { api, users, tokenStore } = consoleClient(({ path }) => {
      if (path === '/auth/me') return admin
      throw new ApiError('server response', { kind: 'http', status })
    }, 'saved')
    await api.restoreSession()
    await assert.rejects(api.getDashboard(), /server response/)
    assert.equal(tokenStore.get(), status === 503 ? 'saved' : null)
    assert.equal(users.at(-1), status === 503 ? admin : null)
  }
})

test('a delayed response for an older token cannot evict a newer session', async () => {
  let rejectRequest
  const { api, tokenStore } = consoleClient(() => new Promise((_, reject) => { rejectRequest = reject }), 'old')
  const pending = api.getDashboard()
  await Promise.resolve()
  tokenStore.set('new')
  rejectRequest(new ApiError('expired', { kind: 'http', status: 401 }))
  await assert.rejects(pending, /expired/)
  assert.equal(tokenStore.get(), 'new')
})

test('protected post images retain their binary bytes for moderation preview', async () => {
  const original = globalThis.fetch
  const bytes = Uint8Array.of(137, 80, 78, 71, 255)
  let request
  globalThis.fetch = async (url, init) => {
    request = { url, init }
    return new Response(bytes, { headers: { 'Content-Type': 'image/png' } })
  }
  try {
    const transport = createAdminHttpTransport({ baseUrl: 'https://example.org/api/v1', getToken: () => 'review' })
    const api = createAdminApiClient({ mode: 'api', transport })
    const image = await api.getPostImage('i1')
    assert.equal(request.url, 'https://example.org/api/v1/images/i1')
    assert.equal(request.init.headers.Authorization, 'Bearer review')
    assert.equal(image.type, 'image/png')
    assert.deepEqual(new Uint8Array(await image.arrayBuffer()), bytes)
  } finally {
    globalThis.fetch = original
  }
})

test('logout clears the local identity even if revocation fails', async () => {
  const { api, tokenStore } = consoleClient(() => { throw new Error('offline') }, 'saved')
  await assert.rejects(api.signOut(), /offline/)
  assert.equal(tokenStore.get(), null)
})

test('catalog management searches private and public records and writes only supplied fields', async () => {
  const draft = { title: 'Winter cup', category: 'Coding', registrationDeadline: '2026-12-11T08:00:00Z',
    eligibilityRules: 'Students', maxTeamSize: 3, officialSourceUrl: 'https://example.org/',
    description: 'Compete in teams.', coverImage: null, published: false }
  const { api, calls } = consoleClient(() => [], 'saved')
  await api.listCompetitions('Winter', 20, 20)
  await api.createCompetition(draft)
  await api.updateCompetition('a/b', { published: true })
  await api.deleteCompetition('a/b')
  assert.deepEqual(calls.map(c => [c.method ?? 'GET', c.path]), [
    ['GET', '/admin/competitions'], ['POST', '/competitions'],
    ['PATCH', '/competitions/a%2Fb'], ['DELETE', '/competitions/a%2Fb'],
  ])
  assert.deepEqual(calls[0].query, { q: 'Winter', offset: 20, limit: 20 })
  assert.deepEqual(calls[1].body, draft)
  assert.deepEqual(calls[2].body, { published: true })
  assert.ok(calls.every(c => c.auth === 'required'))
})

const post = { id: 'p', revisionId: 'p', targetId: 'post', kind: 'Post', status: 'Approved', proposed: { text: 'Hello' } }
const recruitment = { id: 'r', teamId: 't', status: 'Approved', removed: false, proposed: { name: 'Winter team' } }
const submission = { ...post, kind: 'Competition', status: 'Pending', revisionId: 's', id: 's', proposed: { title: 'New cup' } }

test('approved content and recruitment remain discoverable by status with fresh clients', async () => {
  for (const [queue, path, row] of [['Content', '/moderation', post], ['Recruitment', '/moderation/recruitments', recruitment]]) {
    const { api, calls } = consoleClient(() => [row], 'saved')
    const page = await api.listRevisions(queue, 'Approved', 0, 10)
    assert.equal(calls[0].path, path)
    assert.equal(calls[0].query.status, 'Approved')
    assert.equal(calls[0].auth, 'required')
    assert.equal(page.items[0].revisionId, row.id)
    assert.equal(page.items[0].targetId, row.teamId ?? row.targetId)
    assert.equal(page.nextOffset, null)
    await api.getRevision(page.items[0])
    assert.equal(calls[1].path, path + '/' + row.id)
  }
})

test('submission browsing finds later mixed-queue pages and resumes without duplicates', async () => {
  const rows = [post, post, submission, post, { ...submission, revisionId: 's2' }]
  const { api } = consoleClient(({ query }) => rows.slice(query.offset, query.offset + query.limit), 'saved')
  const first = await api.listRevisions('Competition', 'Pending', 0, 1)
  assert.deepEqual(first.items.map(x => x.revisionId), ['s'])
  assert.ok(first.nextOffset > 0)
  const last = await api.listRevisions('Competition', 'Pending', first.nextOffset, 1)
  assert.deepEqual(last.items.map(x => x.revisionId), ['s2'])
  assert.equal(last.nextOffset, null)
})

test('post/comment/submission decisions use revision ids and the content action schema', async () => {
  const { api, calls } = consoleClient(() => ({}), 'saved')
  for (const kind of ['Post', 'Comment', 'Competition']) {
    for (const action of kind === 'Competition' ? ['Approve', 'Reject'] : ['Approve', 'Reject', 'Remove']) {
      const row = { ...post, kind, status: 'Pending' }
      await api.decide(row, action, action === 'Approve' ? '' : '  Reason  ')
      assert.equal(calls.at(-1).path, '/moderation/p')
      assert.equal(calls.at(-1).method, 'POST')
      assert.equal(calls.at(-1).auth, 'required')
      assert.deepEqual(calls.at(-1).body, action === 'Approve' ? { action } : { action, reason: 'Reason' })
    }
  }
})

test('recruitment decisions use their own wire values and removal targets the team', async () => {
  const { api, calls } = consoleClient(() => ({}), 'saved')
  const row = { ...post, kind: 'Recruitment', status: 'Pending', revisionId: 'r', targetId: 't' }
  await api.decide(row, 'Approve', '')
  await api.decide(row, 'Reject', 'Outside scope')
  await api.decide({ ...row, status: 'Approved' }, 'Remove', '')
  assert.deepEqual(calls.map(c => [c.method, c.path, c.body]), [
    ['POST', '/moderation/recruitments/r/decision', { decision: 'Approved' }],
    ['POST', '/moderation/recruitments/r/decision', { decision: 'Rejected', reason: 'Outside scope' }],
    ['DELETE', '/moderation/recruitments/team/t', undefined],
  ])
})

test('removed, withdrawn and processed revisions expose only permitted actions', async () => {
  const { api, calls } = consoleClient(() => ({}), 'saved')
  for (const kind of ['Recruitment', 'Post', 'Comment', 'Competition']) {
    for (const flag of ['removed', 'deleted']) {
      const row = { ...post, kind, status: 'Pending', [flag]: true }
      assert.deepEqual(api.actionsFor(row), [])
      await assert.rejects(api.decide(row, 'Approve', ''))
    }
    assert.deepEqual(api.actionsFor({ ...post, kind }), kind === 'Competition' ? [] : ['Remove'])
  }
  await assert.rejects(api.decide(submission, 'Remove', 'reason'))
  await assert.rejects(api.decide(post, 'Remove', '   '), /reason/i)
  assert.equal(calls.length, 0)
})
