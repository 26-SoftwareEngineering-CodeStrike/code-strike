import assert from 'node:assert/strict'
import test from 'node:test'
import { createAdminApiClient } from '../../src/api/client.ts'
import { createAdminHttpTransport } from '../../src/api/http-transport.ts'

/**
 * T6 live end-to-end tests. Drives the real admin-web API client against the
 * running FastAPI backend and MySQL 8.4 database: admin login, non-admin
 * rejection + revocation, live /dashboard counts, /admin/competitions CRUD,
 * unified moderation queues (Content / Competition / Recruitment), protected
 * binary image preview, and logout revocation.
 */

const baseUrl = process.env.CODE_STRIKE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'
const adminUsername =
  process.env.CODESTRIKE_ADMIN_USERNAME ?? process.env.CODE_STRIKE_ADMIN_USERNAME ?? ''
const adminPassword =
  process.env.CODESTRIKE_ADMIN_PASSWORD ?? process.env.CODE_STRIKE_ADMIN_PASSWORD ?? ''

const SAMPLE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAFAAAABACAIAAAACpWdhAAAAgElEQVR42u3PQQ2AMBQFwarAB8EKeEBLNSCEEEzhgFbCO/5kkhWw05b1iNr6E7XfV9T3nlHpfwMGBgYGBgYGBgYGBgYGHuDqgPQfGBgYGBgYGBgYGBgYGHiCqwPSf2BgYGBgYGBgYGBgYGDgCa4OSP+BgYGBgYGBgYGBgYGBgUc/CeYRtAQ6InUAAAAASUVORK5CYII='

function makeAdminClient() {
  let token = null
  const tokenStore = {
    get: () => token,
    set: (value) => { token = value },
    clear: () => { token = null },
  }
  const transport = createAdminHttpTransport({
    baseUrl,
    getToken: () => tokenStore.get(),
  })
  const api = createAdminApiClient({ mode: 'api', transport, tokenStore })
  return { api, tokenStore }
}

async function rawJson(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new Error(`${method} ${path} failed (${response.status}): ${text}`)
  }
  return data
}

async function reachable() {
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(5000) })
    return response.ok
  } catch {
    return false
  }
}

const online = await reachable()
const skip =
  online && adminUsername && adminPassword
    ? false
    : `Requires running API at ${baseUrl} and admin credentials in environment.`

test('admin client rejects and revokes student logins, authenticates admins and manages competitions', { skip }, async () => {
  // 1. Register a student and confirm admin client rejects & revokes the issued token.
  const studentName = `t6_stu_${Date.now().toString(36)}`
  const studentPass = `T6-Stu-${Date.now().toString(36)}!`
  await rawJson('/auth/register', { method: 'POST', body: { username: studentName, password: studentPass } })

  const { api, tokenStore } = makeAdminClient()
  await assert.rejects(
    () => api.signIn({ username: studentName, password: studentPass }),
    /administrator/i,
  )
  assert.equal(tokenStore.get(), null)

  // 2. Real administrator login and /auth/me session restoration.
  const user = await api.signIn({ username: adminUsername, password: adminPassword })
  assert.equal(user.role, 'Admin')
  assert.ok(tokenStore.get())

  const fresh = makeAdminClient()
  fresh.tokenStore.set(tokenStore.get())
  const restored = await fresh.api.restoreSession()
  assert.equal(restored.username, adminUsername)
  assert.equal(restored.role, 'Admin')

  // 3. Dashboard metrics load cleanly.
  const dash = await api.getDashboard()
  assert.equal(typeof dash.competitionCount, 'number')
  assert.equal(typeof dash.moderationCount, 'number')

  // 4. Create unpublished competition, search via /admin/competitions, publish via PATCH, then DELETE.
  const title = `T6 Admin Live Cup ${Date.now().toString(36)}`
  const created = await api.createCompetition({
    title,
    category: 'Security',
    description: 'Draft competition from T6/T8 live E2E.',
    registrationDeadline: '2029-06-01T12:00:00Z',
    eligibilityRules: 'University students',
    maxTeamSize: 4,
    officialSourceUrl: 'https://example.org/t6-live',
    coverImage: null,
    published: false,
  })
  assert.equal(created.published, false)

  const found = await api.listCompetitions(title, 0, 20)
  assert.equal(found.some((item) => item.id === created.id), true)

  const published = await api.updateCompetition(created.id, { published: true })
  assert.equal(published.published, true)

  await api.deleteCompetition(created.id)
  const afterDelete = await api.listCompetitions(title, 0, 20)
  assert.equal(afterDelete.some((item) => item.id === created.id), false)

  // 5. Sign out revokes token on server.
  const revokedToken = tokenStore.get()
  await api.signOut()
  assert.equal(tokenStore.get(), null)
  const revokedCheck = await fetch(`${baseUrl}/dashboard`, {
    headers: { Authorization: `Bearer ${revokedToken}` },
  })
  assert.equal(revokedCheck.status, 401)
})

test('admin moderation API reviews Content, Competition submission and Recruitment queues with protected images', { skip }, async () => {
  const { api, tokenStore } = makeAdminClient()
  await api.signIn({ username: adminUsername, password: adminPassword })

  let skills = await rawJson('/skills')
  if (!skills.length) {
    skills = [
      await rawJson('/skills', {
        method: 'POST',
        token: tokenStore.get(),
        body: { name: 'Python' },
      }),
    ]
  }

  const comp = await api.createCompetition({
    title: `T6 Moderation Cup ${Date.now().toString(36)}`,
    category: 'Systems',
    description: 'Competition hosting T6 moderation queue E2E checks.',
    registrationDeadline: '2029-06-01T12:00:00Z',
    eligibilityRules: 'Enrolled students',
    maxTeamSize: 4,
    officialSourceUrl: 'https://example.org/t6-mod',
    coverImage: null,
    published: true,
  })

  // Provision a complete student to create a post (with PNG), a recruitment, and a competition submission.
  const studentAuth = await rawJson('/auth/register', {
    method: 'POST',
    body: {
      username: `t6_author_${Date.now().toString(36)}`,
      password: `T6-Auth-${Date.now().toString(36)}!`,
    },
  })
  const studentToken = studentAuth.accessToken
  await rawJson('/profiles/me', {
    method: 'PATCH',
    token: studentToken,
    body: {
      name: 'Moderation Author',
      college: 'Computer Science',
      major: 'Software Engineering',
      academicYear: '2026',
      sex: 'Unspecified',
      briefCv: 'Testing admin moderation queues.',
      wechatId: 't6_author_wx',
      skillIds: [skills[0].id],
    },
  })

  const post = await rawJson(`/competitions/${comp.id}/posts`, {
    method: 'POST',
    token: studentToken,
    body: {
      text: 'Admin preview test post',
      links: [],
      images: [{ dataBase64: SAMPLE_PNG_BASE64 }],
    },
  })
  const team = await rawJson('/teams', {
    method: 'POST',
    token: studentToken,
    body: {
      competitionId: comp.id,
      name: 'Moderation Squad',
      summary: 'Testing recruitment moderation queue.',
      capacity: 3,
      skillIds: [skills[0].id],
      submitRecruitment: true,
    },
  })
  const submission = await rawJson('/competition-submissions', {
    method: 'POST',
    token: studentToken,
    body: {
      title: `Submitted Cup ${Date.now().toString(36)}`,
      category: 'Robotics',
      description: 'Testing admin competition submission queue.',
      registrationDeadline: '2029-07-01T12:00:00Z',
      eligibilityRules: 'Students',
      maxTeamSize: 4,
      officialSourceUrl: 'https://example.org/t6-sub',
      coverImage: null,
    },
  })

  // 1. Content queue: load detail, fetch protected binary PNG via getPostImage, approve, then remove.
  const contentQueue = await api.listRevisions('Content', 'Pending', 0, 50)
  const postItem = contentQueue.items.find((item) => item.revisionId === post.revisionId)
  assert.ok(postItem)
  const postDetail = await api.getRevision(postItem)
  assert.equal(postDetail.proposed.imageIds.length, 1)
  const blob = await api.getPostImage(postDetail.proposed.imageIds[0])
  assert.equal(blob.type, 'image/png')
  assert.ok(blob.size > 0)

  await api.decide(postItem, 'Approve', '')
  const approvedQueue = await api.listRevisions('Content', 'Approved', 0, 50)
  const approvedPost = approvedQueue.items.find((item) => item.revisionId === post.revisionId)
  assert.ok(approvedPost)
  await api.decide(approvedPost, 'Remove', 'Cleanup after E2E verification')

  // 2. Competition submission queue: reject with reason.
  const subQueue = await api.listRevisions('Competition', 'Pending', 0, 50)
  const subItem = subQueue.items.find((item) => item.revisionId === submission.revisionId)
  assert.ok(subItem)
  await api.decide(subItem, 'Reject', 'Duplicate test submission')

  // 3. Recruitment queue: approve then delist (Remove).
  const recQueue = await api.listRevisions('Recruitment', 'Pending', 0, 50)
  const recItem = recQueue.items.find((item) => item.revisionId === team.revision.id)
  assert.ok(recItem)
  await api.decide(recItem, 'Approve', '')
  const recApproved = (await api.listRevisions('Recruitment', 'Approved', 0, 50)).items.find(
    (item) => item.revisionId === team.revision.id,
  )
  assert.ok(recApproved)
  await api.decide(recApproved, 'Remove', '')

  await api.signOut()
})
