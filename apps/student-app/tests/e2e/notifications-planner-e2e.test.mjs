import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * T7 end-to-end tests. Drives the real student client (notifications + planner)
 * against the running FastAPI backend and MySQL 8.4 database.
 *
 * Expects CODE_STRIKE_API_BASE_URL (default http://127.0.0.1:8000/api/v1) and
 * CODE_STRIKE_ADMIN_USERNAME / CODE_STRIKE_ADMIN_PASSWORD for seeding admission
 * and moderation events. Skips cleanly when the backend is offline.
 */

const baseUrl = process.env.CODE_STRIKE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'
const adminUsername = process.env.CODE_STRIKE_ADMIN_USERNAME ?? ''
const adminPassword = process.env.CODE_STRIKE_ADMIN_PASSWORD ?? ''

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
  return `T7-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}!`
}

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
const skip = online
  ? false
  : `The CodeStrike API is not reachable at ${baseUrl}. Start the backend before running T7 E2E tests.`
const skipAdmin = skip || (!adminUsername || !adminPassword
  ? 'Set CODE_STRIKE_ADMIN_USERNAME and CODE_STRIKE_ADMIN_PASSWORD for notification event tests.'
  : false)

let incompleteToken = null
let otherStudentToken = null

test('incomplete-profile student can create, reload, edit, complete and delete planner items', { skip }, async () => {
  const { api, tokenStore } = makeClient()
  const user = uniqueId('t7_plan')
  const pass = uniquePassword()
  const token = await api.register({ username: user, password: pass })
  tokenStore.set(token.accessToken)
  incompleteToken = token.accessToken

  const other = makeClient()
  const otherToken = await other.api.register({ username: uniqueId('t7_other'), password: uniquePassword() })
  other.tokenStore.set(otherToken.accessToken)
  otherStudentToken = otherToken.accessToken

  // Confirm profile is incomplete yet planner access succeeds (FR-02).
  const profile = await api.getProfile()
  assert.equal(profile.complete, false)

  // Overlapping TimedPlans on the same date are allowed.
  const p1 = await api.createPlannerItem({
    type: 'TimedPlan',
    title: 'Algorithm review',
    assignedDate: '2026-11-25',
    startTime: '09:00',
    endTime: '10:30',
    repeatCount: 1,
  })
  assert.equal(p1.ok, true, p1.message)
  const p2 = await api.createPlannerItem({
    type: 'TimedPlan',
    title: 'Overlapping standup',
    assignedDate: '2026-11-25',
    startTime: '09:30',
    endTime: '10:00',
    repeatCount: 1,
  })
  assert.equal(p2.ok, true, p2.message)

  // Create a 3-week repeating Todo with a deadline.
  const todos = await api.createPlannerItem({
    type: 'Todo',
    title: 'Weekly sprint check-in',
    description: 'Update progress notes',
    assignedDate: '2026-11-25',
    deadline: '2026-11-26',
    repeatCount: 3,
  })
  assert.equal(todos.ok, true, todos.message)
  assert.equal(todos.data.length, 3)
  const [todo1, todo2, todo3] = todos.data

  // Single-occurrence mutations: complete #1, edit & clear deadline on #2, delete #3.
  const done = await api.togglePlannerTodo(todo1.id, true)
  assert.equal(done.ok, true, done.message)
  assert.equal(done.data.completed, true)

  const edited = await api.updatePlannerOccurrence(todo2.id, {
    title: 'Week 2 sprint check-in (edited)',
    actualDate: todo2.actualDate,
    description: 'Updated description only for occurrence 2',
    clearDeadline: true,
  })
  assert.equal(edited.ok, true, edited.message)
  assert.equal(edited.data.title, 'Week 2 sprint check-in (edited)')
  assert.equal(edited.data.deadline, undefined)

  const removed = await api.deletePlannerOccurrence(todo3.id)
  assert.equal(removed.ok, true, removed.message)

  // Fresh client verifies full persistence across reloads in MySQL.
  const fresh = makeClient(token.accessToken).api
  const day = await fresh.getPlannerView('2026-11-25', 'Day')
  assert.equal(day.ok, true, day.message)
  assert.equal(day.data.occurrences.length, 3)
  const reloadedTodo1 = day.data.occurrences.find((item) => item.id === todo1.id)
  assert.equal(reloadedTodo1.completed, true)
  assert.equal(reloadedTodo1.title, 'Weekly sprint check-in')

  const week2 = await fresh.getPlannerView(todo2.actualDate, 'Week')
  assert.equal(week2.ok, true, week2.message)
  const reloadedTodo2 = week2.data.occurrences.find((item) => item.id === todo2.id)
  assert.equal(reloadedTodo2.title, 'Week 2 sprint check-in (edited)')
  assert.equal(reloadedTodo2.completed, false)
  assert.equal(reloadedTodo2.deadline, undefined)

  const missingTodo3 = await fresh.getPlannerOccurrence(todo3.id)
  assert.equal(missingTodo3.ok, false)

  // Other student sees empty day view and cannot read or mutate owner's occurrence.
  const otherDay = await other.api.getPlannerView('2026-11-25', 'Day')
  assert.equal(otherDay.ok, true)
  assert.equal(otherDay.data.occurrences.length, 0)
  const denied = await other.api.getPlannerOccurrence(todo1.id)
  assert.equal(denied.ok, false)
})

test('course creation respects server timetable config or deduplicates cleanly', { skip }, async () => {
  const { api } = makeClient(incompleteToken)
  const first = await api.createCourse({
    name: 'Software Engineering',
    actualStartWeek: '2026-09-07',
    startWeek: 1,
    weekday: 1,
    startPeriod: 1,
    endPeriod: 2,
    room: 'Room A101',
    repeatCount: 2,
  })
  if (!first.ok && first.code === 'PLANNER_CONFIG_MISSING') {
    assert.equal(first.code, 'PLANNER_CONFIG_MISSING')
    return
  }
  assert.equal(first.ok, true, first.message)
  assert.equal(first.data.createdCount, 2)
  assert.equal(first.data.skippedDuplicateCount, 0)

  const second = await api.createCourse({
    name: 'Software Engineering',
    actualStartWeek: '2026-09-07',
    startWeek: 2,
    weekday: 1,
    startPeriod: 1,
    endPeriod: 2,
    room: 'Room A101',
    repeatCount: 2,
  })
  assert.equal(second.ok, true, second.message)
  assert.equal(second.data.createdCount, 1)
  assert.equal(second.data.skippedDuplicateCount, 1)
})

test('notifications reflect admission and moderation events, persist read state and enforce recipient privacy', { skip: skipAdmin }, async () => {
  const adminAuth = await rawJson('/auth/login', {
    method: 'POST',
    body: { username: adminUsername, password: adminPassword },
  })
  const adminToken = adminAuth.accessToken

  let skills = await rawJson('/skills')
  if (!skills.length) {
    skills = [await rawJson('/skills', { method: 'POST', token: adminToken, body: { name: 'TypeScript' } })]
  }
  const comp = await rawJson('/competitions', {
    method: 'POST',
    token: adminToken,
    body: {
      title: `T7 Notification Cup ${Date.now()}`,
      category: 'Software',
      description: 'Verify admission and moderation notifications.',
      registrationDeadline: '2028-12-01T12:00:00Z',
      eligibilityRules: 'Enrolled students',
      maxTeamSize: 4,
      officialSourceUrl: 'https://example.org/t7-cup',
      coverImage: null,
      published: true,
    },
  })

  async function registerCompleteStudent(prefix) {
    const handle = makeClient()
    const token = await handle.api.register({ username: uniqueId(prefix), password: uniquePassword() })
    handle.tokenStore.set(token.accessToken)
    await handle.api.saveProfile({
      name: prefix,
      college: 'Computer Science',
      major: 'Software Engineering',
      academicYear: '3',
      sex: 'Unspecified',
      briefCv: 'Testing T7 notifications.',
      wechatId: `${prefix}_wx`,
      skillIds: [skills[0].id],
    })
    return { api: handle.api, token: token.accessToken }
  }

  const captain = await registerCompleteStudent('t7_cap')
  const applicant = await registerCompleteStudent('t7_app')

  // 1. Recruitment approval -> ModerationApproved notification for captain.
  const createdTeam = await rawJson('/teams', {
    method: 'POST',
    token: captain.token,
    body: {
      competitionId: comp.id,
      name: 'Notify Squad',
      summary: 'Testing T7 notifications.',
      capacity: 3,
      skillIds: [skills[0].id],
      submitRecruitment: true,
    },
  })
  await rawJson(`/moderation/recruitments/${createdTeam.revision.id}/decision`, {
    method: 'POST',
    token: adminToken,
    body: { decision: 'Approved' },
  })

  // 2. Application submission & approval -> NewApplication (captain) + ApplicationApproved (applicant).
  const applied = await applicant.api.applyToTeam(createdTeam.id)
  assert.equal(applied.ok, true, applied.message)
  const approved = await captain.api.approveApplication(applied.data.id)
  assert.equal(approved.ok, true, approved.message)

  // 3. Community post approval & rejection -> ModerationApprove / ModerationReject for applicant.
  const post = await applicant.api.community.createPost(comp.id, {
    text: 'Initial T7 discussion post',
    links: [],
    images: [],
  })
  await rawJson(`/moderation/${post.revisionId}`, {
    method: 'POST',
    token: adminToken,
    body: { action: 'Approve' },
  })
  const edit = await applicant.api.community.editPost(post.id, {
    text: 'Rejected T7 post edit',
    links: [],
    images: [],
  })
  await rawJson(`/moderation/${edit.revisionId}`, {
    method: 'POST',
    token: adminToken,
    body: { action: 'Reject', reason: 'Off-topic edit' },
  })

  // Verify captain inbox contains recruitment moderation + admission events.
  const captainInbox = await captain.api.notifications.inbox(0, 50)
  const captainEvents = captainInbox.items.map((item) => item.event)
  assert.ok(captainEvents.includes('ModerationApproved'), `missing ModerationApproved in ${captainEvents}`)
  assert.ok(captainEvents.includes('NewApplication'), `missing NewApplication in ${captainEvents}`)

  // Verify applicant inbox contains admission + post moderation events.
  const appInbox = await applicant.api.notifications.inbox(0, 50)
  const appEvents = appInbox.items.map((item) => item.event)
  assert.ok(appEvents.includes('ApplicationApproved'), `missing ApplicationApproved in ${appEvents}`)
  assert.ok(appEvents.includes('ModerationApprove'), `missing ModerationApprove in ${appEvents}`)
  assert.ok(appEvents.includes('ModerationReject'), `missing ModerationReject in ${appEvents}`)
  const initialUnread = appInbox.unreadCount
  assert.ok(initialUnread >= 3)

  // Mark one notification read and verify persistence on a fresh client.
  const target = appInbox.items[0]
  const marked = await applicant.api.notifications.setRead(target.id, true)
  assert.equal(marked.isRead, true)

  const freshApplicant = makeClient(applicant.token).api
  const reloadedInbox = await freshApplicant.notifications.inbox(0, 50)
  assert.equal(reloadedInbox.unreadCount, initialUnread - 1)
  assert.equal(reloadedInbox.items.find((row) => row.id === target.id).isRead, true)

  // Recipient privacy: another student cannot read or modify applicant's notification.
  const stranger = makeClient(otherStudentToken).api
  await assert.rejects(() => stranger.notifications.detail(target.id), /not found/i)
  await assert.rejects(() => stranger.notifications.setRead(target.id, true), /not found/i)
})
