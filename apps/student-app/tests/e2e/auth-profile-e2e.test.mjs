import assert from 'node:assert/strict'
import test from 'node:test'
import { writeFile } from 'node:fs/promises'

/**
 * T3 end-to-end tests. They drive the real student client against the real
 * FastAPI backend and the real MySQL 8.4 instance, so a passing run proves
 * the account flow works end to end rather than against a stub.
 *
 * The backend has to be running and reachable at CODE_STRIKE_API_BASE_URL.
 * When it is not, the tests report themselves as skipped, never as passed.
 */

const baseUrl = process.env.CODE_STRIKE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'

const storage = new Map()
globalThis.uni = {
  getStorageSync: (key) => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: (key) => storage.delete(key),
}

const { createStudentApiClient } = await import('../../src/api/client.ts')
const { createStudentHttpTransport } = await import('../../src/api/http-transport.ts')
const { appTokenStore } = await import('../../src/api/token-store.ts')
const { HttpTransport } = await import('@codestrike/contracts/http')

function uniqueUsername() {
  return `t3_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`
}

/** A throwaway password for the account this run creates; never a real credential. */
function uniquePassword() {
  return `T3-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

async function reachable() {
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(5000) })
    return response.ok
  } catch {
    return false
  }
}

/** Stands in for the uni.request bridge, which only exists on a device. */
function fetchAdapter() {
  return async (request) => {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.header,
      body: request.data === undefined ? undefined : JSON.stringify(request.data),
    })
    const text = await response.text()
    return { statusCode: response.status, data: text ? JSON.parse(text) : null }
  }
}

const online = await reachable()
const skip = online
  ? false
  : `The CodeStrike API is not reachable at ${baseUrl}. Start the backend before running the end-to-end tests.`

const username = uniqueUsername()
const password = uniquePassword()
// The database check reads the account this run created.
await writeFile('../../.tools/t3-test-account.txt', username, 'utf8')
const transport = createStudentHttpTransport({
  baseUrl,
  adapter: fetchAdapter(),
  tokenStore: appTokenStore,
})
const api = createStudentApiClient({ mode: 'api', transport })

test('a student registers and receives a session', { skip }, async () => {
  const token = await api.register({ username, password })

  assert.equal(token.tokenType, 'bearer')
  assert.equal(typeof token.accessToken, 'string')
  assert.ok(token.accessToken.length > 0)
  assert.equal(token.user.username, username)
  assert.equal(token.user.role, 'Student')
  assert.equal(token.user.email, null)
})

test('a duplicate username is rejected by the backend', { skip }, async () => {
  await assert.rejects(
    () => api.register({ username, password }),
    (error) => {
      assert.equal(error.status, 409)
      assert.equal(error.code, 'USERNAME_EXISTS')
      assert.equal(error.message, 'Username is already registered.')
      return true
    },
  )
})

test('the correct password signs the student in', { skip }, async () => {
  const token = await api.login({ username, password })

  assert.equal(token.user.username, username)
  assert.equal(token.user.role, 'Student')
})

test('a wrong password is refused', { skip }, async () => {
  await assert.rejects(
    () => api.login({ username, password: 'definitely-not-the-password' }),
    (error) => {
      assert.equal(error.status, 401)
      assert.equal(error.code, 'INVALID_CREDENTIALS')
      assert.equal(error.message, 'Invalid username or password.')
      return true
    },
  )
})

test('the current user is read back from the API', { skip }, async () => {
  const user = await api.restoreSession()

  assert.equal(user.username, username)
  assert.equal(user.role, 'Student')
})

test('a fresh profile reports every missing required field', { skip }, async () => {
  const profile = await api.getProfile()

  assert.equal(profile.userId.length > 0, true)
  assert.equal(profile.complete, false)
  assert.deepEqual(profile.missingFields.sort(), [
    'academicYear',
    'briefCv',
    'college',
    'contact',
    'major',
    'name',
    'sex',
    'skills',
  ])
})

test('the profile is saved and read back from the API', { skip }, async () => {
  const saved = await api.saveProfile({
    name: 'Alex Chen',
    college: 'School of Computer Science',
    major: 'Software Engineering',
    academicYear: '2026',
    sex: 'Female',
    briefCv: 'Built two course projects and led a campus navigation prototype.',
    wechatId: 'alex_wechat_demo',
    qqId: '',
    mbti: 'INFJ',
    hobbies: 'Cycling, photography',
  })

  assert.equal(saved.name, 'Alex Chen')
  assert.equal(saved.college, 'School of Computer Science')
  assert.equal(saved.academicYear, '2026')
  assert.equal(saved.mbti, 'INFJ')
  assert.equal(saved.complete, false)

  const reread = await api.getProfile()
  assert.equal(reread.name, 'Alex Chen')
  assert.equal(reread.briefCv, 'Built two course projects and led a campus navigation prototype.')
  assert.equal(reread.wechatId, 'alex_wechat_demo')
})

test('skill tags are taken from the administrator catalog', { skip }, async () => {
  const catalog = await api.listSkills()

  assert.equal(catalog.length > 0, true)
  assert.equal(catalog.some((skill) => skill.name === 'Python'), true)

  const python = catalog.find((skill) => skill.name === 'Python')
  const saved = await api.saveProfile({ skillIds: [python.id] })

  assert.deepEqual(saved.skillIds, [python.id])
  assert.deepEqual(saved.skills.map((skill) => skill.name), ['Python'])
  assert.equal(saved.missingFields.includes('skills'), false)
})

test('a skill id outside the catalog is rejected', { skip }, async () => {
  await assert.rejects(
    () => api.saveProfile({ skillIds: ['00000000-0000-0000-0000-000000000000'] }),
    (error) => {
      assert.equal(error.status, 422)
      assert.equal(error.code, 'INVALID_SKILLS')
      return true
    },
  )
})

test('a complete profile is reported as complete', { skip }, async () => {
  const profile = await api.getProfile()

  assert.equal(profile.complete, true)
  assert.deepEqual(profile.missingFields, [])
})

test('a student cannot extend the administrator catalog', { skip }, async () => {
  const transport = new HttpTransport({
    baseUrl,
    adapter: async (request) => {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.header,
        body: request.data === undefined ? undefined : JSON.stringify(request.data),
      })
      const text = await response.text()
      return { statusCode: response.status, data: text ? JSON.parse(text) : null }
    },
    getToken: () => storage.get('codestrike:access-token'),
  })

  await assert.rejects(
    () => transport.request({ path: '/skills', method: 'POST', body: { name: 'Student Invented Tag' } }),
    (error) => {
      assert.equal(error.status, 403)
      assert.equal(error.code, 'FORBIDDEN')
      assert.equal(error.message, 'This operation is not permitted.')
      return true
    },
  )
})

test('a protected route without a token is refused', { skip }, async () => {
  const transport = new HttpTransport({
    baseUrl,
    adapter: async (request) => {
      const response = await fetch(request.url, { method: request.method, headers: request.header })
      const text = await response.text()
      return { statusCode: response.status, data: text ? JSON.parse(text) : null }
    },
  })

  await assert.rejects(
    () => transport.request({ path: '/profiles/me' }),
    (error) => {
      assert.equal(error.status, 401)
      assert.equal(error.code, 'UNAUTHENTICATED')
      return true
    },
  )
})

test('an invalid token is refused', { skip }, async () => {
  const transport = new HttpTransport({
    baseUrl,
    adapter: async (request) => {
      const response = await fetch(request.url, { method: request.method, headers: request.header })
      const text = await response.text()
      return { statusCode: response.status, data: text ? JSON.parse(text) : null }
    },
    getToken: () => 'not-a-real-token-value',
  })

  await assert.rejects(
    () => transport.request({ path: '/auth/me' }),
    (error) => {
      assert.equal(error.status, 401)
      assert.equal(error.code, 'UNAUTHENTICATED')
      return true
    },
  )
})

test('signing out revokes the token', { skip }, async () => {
  const revoked = appTokenStore.get()
  assert.ok(revoked)

  await api.logout()

  assert.equal(storage.get('codestrike:access-token'), undefined)

  const revokedTransport = new HttpTransport({
    baseUrl,
    adapter: fetchAdapter(),
    getToken: () => revoked,
  })
  await assert.rejects(
    () => revokedTransport.request({ path: '/auth/me' }),
    (error) => {
      assert.equal(error.status, 401)
      assert.equal(error.code, 'UNAUTHENTICATED')
      return true
    },
  )

  assert.equal(await api.restoreSession(), null)
})
