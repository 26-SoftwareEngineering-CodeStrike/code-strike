import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * T5 end-to-end tests. Drives the real student community client against the
 * running FastAPI backend and MySQL 8.4 database (posts, protected PNG images,
 * comments & replies, Like/Favorite reload persistence, and competition
 * submissions). Skips cleanly when the backend or admin credentials are absent.
 */

const baseUrl = process.env.CODE_STRIKE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'
const adminUsername =
  process.env.CODESTRIKE_ADMIN_USERNAME ?? process.env.CODE_STRIKE_ADMIN_USERNAME ?? ''
const adminPassword =
  process.env.CODESTRIKE_ADMIN_PASSWORD ?? process.env.CODE_STRIKE_ADMIN_PASSWORD ?? ''

// Minimal valid 1x1 PNG (same fixture pattern verified by backend image validator).
const SAMPLE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAFAAAABACAIAAAACpWdhAAAAgElEQVR42u3PQQ2AMBQFwarAB8EKeEBLNSCEEEzhgFbCO/5kkhWw05b1iNr6E7XfV9T3nlHpfwMGBgYGBgYGBgYGBgYGHuDqgPQfGBgYGBgYGBgYGBgYGHiCqwPSf2BgYGBgYGBgYGBgYGDgCa4OSP+BgYGBgYGBgYGBgYGBgUc/CeYRtAQ6InUAAAAASUVORK5CYII='

const storage = new Map()
globalThis.uni = {
  getStorageSync: (key) => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: (key) => storage.delete(key),
}

const { createStudentApiClient } = await import('../../src/api/client.ts')
const { createStudentHttpTransport } = await import('../../src/api/http-transport.ts')

function uniqueId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`
}

function uniquePassword() {
  return `T5-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}!`
}

function fetchAdapter() {
  return async (request) => {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.header,
      body: request.data === undefined ? undefined : JSON.stringify(request.data),
    })
    const isBinary = request.header?.Accept === 'image/png, image/jpeg'
    if (isBinary && response.ok) {
      return {
        statusCode: response.status,
        data: await response.arrayBuffer(),
        header: Object.fromEntries(response.headers),
      }
    }
    const text = await response.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    return { statusCode: response.status, data, header: Object.fromEntries(response.headers) }
  }
}

function makeClient(initialToken = null) {
  let token = initialToken
  const tokenStore = {
    get: () => token,
    set: (value) => { token = value },
    clear: () => { token = null },
  }
  const transport = createStudentHttpTransport({
    baseUrl,
    adapter: fetchAdapter(),
    tokenStore,
  })
  return { api: createStudentApiClient({ mode: 'api', transport }), tokenStore }
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

test('community post lifecycle: private draft, protected image, comments, interactions and reload persistence', { skip }, async () => {
  const adminToken = (
    await rawJson('/auth/login', {
      method: 'POST',
      body: { username: adminUsername, password: adminPassword },
    })
  ).accessToken

  let skills = await rawJson('/skills')
  if (!skills.length) {
    skills = [await rawJson('/skills', { method: 'POST', token: adminToken, body: { name: 'Python' } })]
  }

  const comp = await rawJson('/competitions', {
    method: 'POST',
    token: adminToken,
    body: {
      title: `T5 Community E2E Cup ${Date.now().toString(36)}`,
      category: 'Software',
      description: 'Automated T5/T8 community end-to-end verification.',
      registrationDeadline: '2028-12-01T12:00:00Z',
      eligibilityRules: 'Enrolled students',
      maxTeamSize: 5,
      officialSourceUrl: 'https://example.org/t5-e2e',
      coverImage: null,
      published: true,
    },
  })

  const author = makeClient()
  const authorAuth = await author.api.register({ username: uniqueId('t5_author'), password: uniquePassword() })
  author.tokenStore.set(authorAuth.accessToken)
  await author.api.saveProfile({
    name: 'Community Author',
    college: 'Computer Science',
    major: 'Software Engineering',
    academicYear: '2026',
    sex: 'Unspecified',
    briefCv: 'Testing T5 community flows.',
    wechatId: 't5_author_wx',
    skillIds: [skills[0].id],
  })

  // Incomplete-profile reader can still comment and like/favorite approved posts.
  const reader = makeClient()
  const readerAuth = await reader.api.register({ username: uniqueId('t5_reader'), password: uniquePassword() })
  reader.tokenStore.set(readerAuth.accessToken)
  const anonymous = makeClient()

  // 1. Create pending post with PNG image -> hidden from public feed, visible in author personal queue.
  const created = await author.api.community.createPost(comp.id, {
    text: 'Initial strategy discussion with attachment.',
    links: ['https://example.org/guide'],
    images: [{ dataBase64: SAMPLE_PNG_BASE64 }],
  })
  assert.equal(created.status, 'Pending')
  assert.equal(created.imageIds.length, 1)

  const feedBefore = await anonymous.api.community.feed(comp.id, false)
  assert.equal(feedBefore.published.some((row) => row.id === created.id), false)

  const authorFeedBefore = await author.api.community.feed(comp.id, true)
  assert.equal(authorFeedBefore.personal.some((row) => row.id === created.id), true)

  // Protected image privacy before approval: author can fetch; stranger & anonymous get 404.
  const authorImg = await author.api.community.image(created.imageIds[0])
  assert.ok(authorImg.startsWith('data:image/png;base64,'))
  await assert.rejects(() => reader.api.community.image(created.imageIds[0]), (err) => err.status === 404)
  await assert.rejects(() => anonymous.api.community.image(created.imageIds[0]), (err) => err.status === 404)

  // 2. Admin approves post -> public feed + image visible to all.
  await rawJson(`/moderation/${created.revisionId}`, {
    method: 'POST',
    token: adminToken,
    body: { action: 'Approve' },
  })
  const feedAfter = await anonymous.api.community.feed(comp.id, false)
  assert.equal(feedAfter.published.some((row) => row.id === created.id), true)
  const publicImg = await anonymous.api.community.image(created.imageIds[0])
  assert.ok(publicImg.startsWith('data:image/png;base64,'))

  // 3. Comments + nested reply (hidden until approved) + ownership check.
  const comment = await reader.api.community.comment(created.id, 'Top-level feedback from reader.', null)
  assert.equal(comment.status, 'Pending')
  assert.equal((await anonymous.api.community.thread(created.id, false, false)).comments.length, 0)
  await rawJson(`/moderation/${comment.revisionId}`, {
    method: 'POST',
    token: adminToken,
    body: { action: 'Approve' },
  })

  const reply = await author.api.community.comment(created.id, 'Thanks for the feedback!', comment.id)
  await rawJson(`/moderation/${reply.revisionId}`, {
    method: 'POST',
    token: adminToken,
    body: { action: 'Approve' },
  })

  // Non-author cannot edit or delete someone else's comment or post.
  await assert.rejects(
    () => author.api.community.deleteComment(comment.id),
    (err) => err.status === 403,
  )
  await assert.rejects(
    () => reader.api.community.deletePost(created.id),
    (err) => err.status === 403,
  )

  // 4. Like and Favorite toggle persisted across fresh client reload.
  await reader.api.community.interact(created.id, 'Like', true)
  await reader.api.community.interact(created.id, 'Favorite', true)
  const freshReader = makeClient(readerAuth.accessToken).api
  const thread = await freshReader.community.thread(created.id, false, true)
  assert.equal(thread.post.likes, 1)
  assert.equal(thread.post.favorites, 1)
  assert.deepEqual(thread.interactions, { liked: true, favorited: true })
  assert.equal(thread.comments.length, 2)
  assert.equal(thread.comments.find((c) => c.id === reply.id).parentId, comment.id)

  // 5. Author edit creates pending revision without replacing approved public text until approved.
  const editRev = await author.api.community.editPost(created.id, {
    text: 'Revised text awaiting moderation.',
    links: ['https://example.org/guide-v2'],
    images: [],
  })
  assert.equal(editRev.status, 'Pending')
  const stillOld = await anonymous.api.community.thread(created.id, false, false)
  assert.equal(stillOld.post.text, 'Initial strategy discussion with attachment.')

  // Delete own comment & post cleanly.
  await reader.api.community.deleteComment(comment.id)
  await author.api.community.deletePost(created.id)
  await assert.rejects(() => anonymous.api.community.thread(created.id, false, false), (err) => err.status === 404)
})

test('student competition submissions stay private until admin approval and support revision/withdrawal', { skip }, async () => {
  const adminToken = (
    await rawJson('/auth/login', {
      method: 'POST',
      body: { username: adminUsername, password: adminPassword },
    })
  ).accessToken

  const student = makeClient()
  const auth = await student.api.register({ username: uniqueId('t5_sub'), password: uniquePassword() })
  student.tokenStore.set(auth.accessToken)

  const titleA = `Student Proposed Cup ${Date.now().toString(36)}`
  const subA = await student.api.community.saveSubmission({
    title: titleA,
    category: 'AI',
    description: 'Initial student competition proposal.',
    registrationDeadline: '2029-05-01T12:00:00Z',
    eligibilityRules: 'Undergraduate students',
    maxTeamSize: 4,
    officialSourceUrl: 'https://example.org/student-cup',
    coverImage: null,
  })
  assert.equal(subA.status, 'Pending')

  // Private before approval.
  const before = await student.api.listCompetitions({ query: titleA })
  assert.equal(before.length, 0)

  // Student updates pending submission before approval.
  const revisedTitle = `${titleA} Revised`
  const subARev = await student.api.community.saveSubmission(
    {
      title: revisedTitle,
      category: 'AI',
      description: 'Updated description before review.',
      registrationDeadline: '2029-05-01T12:00:00Z',
      eligibilityRules: 'Undergraduate students',
      maxTeamSize: 4,
      officialSourceUrl: 'https://example.org/student-cup-v2',
      coverImage: null,
    },
    subA.id,
  )
  assert.equal(subARev.status, 'Pending')
  assert.notEqual(subARev.revisionId, subA.revisionId)

  // Admin approves latest revision -> appears in public competition listing.
  await rawJson(`/moderation/${subARev.revisionId}`, {
    method: 'POST',
    token: adminToken,
    body: { action: 'Approve' },
  })
  const after = await student.api.listCompetitions({ query: revisedTitle })
  assert.equal(after.length, 1)

  // Second submission can be withdrawn by student: preserved as deleted=true in personal
  // history, blocked from further revision, and removed from the admin pending moderation queue.
  const subB = await student.api.community.saveSubmission({
    title: `Withdrawn Cup ${Date.now().toString(36)}`,
    category: 'Design',
    description: 'To be withdrawn.',
    registrationDeadline: '2029-05-01T12:00:00Z',
    eligibilityRules: 'Open',
    maxTeamSize: 3,
    officialSourceUrl: 'https://example.org/withdraw',
    coverImage: null,
  })
  await student.api.community.withdrawSubmission(subB.id)
  const mine = await student.api.community.submissions()
  const withdrawn = mine.find((item) => item.id === subB.id)
  assert.ok(withdrawn)
  assert.equal(withdrawn.deleted, true)
  const pendingQueue = await rawJson('/moderation?status=Pending&limit=100', { token: adminToken })
  assert.equal(pendingQueue.some((item) => item.revisionId === subB.revisionId), false)
})
