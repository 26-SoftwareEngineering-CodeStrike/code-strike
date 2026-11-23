import assert from 'node:assert/strict'
import test from 'node:test'
import { writeFile } from 'node:fs/promises'

/**
 * T4 end-to-end tests. They drive the real student client against the real
 * FastAPI backend and the real MySQL 8.4 instance, so a passing run proves
 * the recruitment, application and captain admission flows work end to end
 * rather than against a stub.
 *
 * Every run creates its own accounts and its own competitions, so the suite
 * never depends on or disturbs the development data.
 *
 * The backend has to be running and reachable at CODE_STRIKE_API_BASE_URL.
 * When it is not, the tests report themselves as skipped, never as passed.
 * The administrator step needs CODESTRIKE_ADMIN_USERNAME and
 * CODESTRIKE_ADMIN_PASSWORD in the environment.
 */

const baseUrl = process.env.CODE_STRIKE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'
const adminUsername = process.env.CODESTRIKE_ADMIN_USERNAME ?? ''
const adminPassword = process.env.CODESTRIKE_ADMIN_PASSWORD ?? ''

const storage = new Map()
globalThis.uni = {
  getStorageSync: (key) => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: (key) => storage.delete(key),
}

const { createStudentApiClient } = await import('../../src/api/client.ts')
const { createStudentHttpTransport } = await import('../../src/api/http-transport.ts')
const { appTokenStore } = await import('../../src/api/token-store.ts')
const { applySessionUser } = await import('../../src/api/session.ts')
const { HttpTransport } = await import('@codestrike/contracts/http')

function uniqueUsername(role) {
  return `t4_${role}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`
}

/** A throwaway password for the accounts this run creates; never a real credential. */
function uniquePassword() {
  return `T4-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
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
  : `The CodeStrike API is not reachable at ${baseUrl}. Start the backend before running the end-to-end tests.`
const skipWithoutAdmin = online && adminUsername && adminPassword ? false : 'The administrator credentials are not in the environment.'

const transport = createStudentHttpTransport({
  baseUrl,
  adapter: fetchAdapter(),
  tokenStore: appTokenStore,
})
const api = createStudentApiClient({ mode: 'api', transport })

/** A second client that carries the administrator token for the review step. */
let adminTransport = null

const accounts = {
  captain: { username: uniqueUsername('captain'), password: uniquePassword() },
  applicantB: { username: uniqueUsername('applicantb'), password: uniquePassword() },
  applicantC: { username: uniqueUsername('applicantc'), password: uniquePassword() },
  outsider: { username: uniqueUsername('outsider'), password: uniquePassword() },
  incomplete: { username: uniqueUsername('incomplete'), password: uniquePassword() },
}

const competitions = {}
const teams = {}
const skillIds = {}

/**
 * The server counts every login attempt of a username inside a fixed window,
 * so each identity signs in once and the token is reused afterwards.
 */
const issuedTokens = new Map()

async function signIn(account) {
  let token = issuedTokens.get(account.username)
  if (!token) {
    token = await api.login({ username: account.username, password: account.password })
    issuedTokens.set(account.username, token)
  }
  appTokenStore.set(token.accessToken)
  applySessionUser(token.user)
}

async function completeProfile(name, skills) {
  await api.saveProfile({
    name,
    college: 'School of Computer Science',
    major: 'Software Engineering',
    academicYear: '2026',
    sex: 'Female',
    briefCv: 'Built two course projects and led a campus navigation prototype.',
    wechatId: `${name.toLowerCase().replace(/\s+/g, '_')}_wechat`,
    qqId: '',
    mbti: 'INFJ',
    hobbies: 'Cycling, photography',
    skillIds: skills,
  })
}

async function adminRequest(method, path, body) {
  if (!adminTransport) {
    adminTransport = new HttpTransport({
      baseUrl,
      adapter: fetchAdapter(),
      getToken: () => adminToken,
    })
  }
  return adminTransport.request({ path, method, body })
}

let adminToken = null

test('the administrator signs in with the provisioned account', { skip: skipWithoutAdmin }, async () => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: adminUsername, password: adminPassword }),
  })
  assert.equal(response.status, 200)
  const payload = await response.json()
  adminToken = payload.accessToken
  assert.equal(payload.user.role, 'Admin')
})

test('the skill catalogue is readable', { skip }, async () => {
  const catalog = await api.listSkills()
  assert.equal(catalog.length > 0, true)
  skillIds.python = catalog.find((skill) => skill.name === 'Python')?.id
  skillIds.java = catalog.find((skill) => skill.name === 'Java')?.id
  skillIds.cad = catalog.find((skill) => skill.name === 'CAD')?.id
  assert.ok(skillIds.python && skillIds.java && skillIds.cad)
})

test('the administrator publishes a competition and keeps one unpublished', { skip: skipWithoutAdmin }, async () => {
  // A student may hold one team per competition, so every scenario below gets
  // its own competition and the scenarios cannot influence each other.
  for (const key of ['open', 'reject', 'withdraw', 'delist', 'capacity', 'race']) {
    const created = await adminRequest('POST', '/competitions', {
      title: `T4 ${key} Competition ${Date.now().toString(36)}`,
      description: 'A competition created by the T4 end-to-end suite.',
      category: 'Innovation',
      registrationDeadline: '2027-06-30T16:00:00Z',
      eligibilityRules: 'Open to enrolled university students.',
      maxTeamSize: 5,
      officialSourceUrl: `https://example.edu/t4-${key}`,
      coverImage: null,
      published: true,
    })
    assert.equal(created.published, true)
    competitions[key] = created
  }

  const hidden = await adminRequest('POST', '/competitions', {
    title: `T4 Unpublished Competition ${Date.now().toString(36)}`,
    description: 'A competition that must never reach the public listing.',
    category: 'Innovation',
    registrationDeadline: '2027-06-30T16:00:00Z',
    eligibilityRules: 'Open to enrolled university students.',
    maxTeamSize: 4,
    officialSourceUrl: 'https://example.edu/t4-hidden',
    coverImage: null,
    published: false,
  })
  assert.equal(hidden.published, false)
  competitions.hidden = hidden
})

test('an unpublished competition is absent from the public listing', { skip }, async () => {
  const competitionsList = await api.listCompetitions({ query: 'T4' })
  const ids = competitionsList.map((competition) => competition.id)
  assert.equal(ids.includes(competitions.open.id), true)
  assert.equal(ids.includes(competitions.hidden.id), false)
})

test('the five test identities register and complete their profiles', { skip }, async () => {
  for (const key of ['captain', 'applicantB', 'applicantC', 'outsider', 'incomplete']) {
    const account = accounts[key]
    const token = await api.register({ username: account.username, password: account.password })
    assert.equal(token.user.role, 'Student')
    assert.equal(token.user.username, account.username)
  }

  await signIn(accounts.captain)
  await completeProfile('Captain A', [skillIds.python, skillIds.java])
  await signIn(accounts.applicantB)
  await completeProfile('Applicant B', [skillIds.python])
  await signIn(accounts.applicantC)
  await completeProfile('Applicant C', [skillIds.cad])
  await signIn(accounts.outsider)
  await completeProfile('Outsider Student', [skillIds.java])
  // The incomplete account deliberately keeps its profile unfinished.
  await signIn(accounts.incomplete)
})

test('the captain creates a team and submits the first recruitment revision', { skip }, async () => {
  await signIn(accounts.captain)
  const created = await api.createTeam({
    competitionId: competitions.open.id,
    name: 'Signal Forge',
    summary: 'A campus navigation concept built by the T4 end-to-end suite.',
    capacity: 4,
    requiredSkills: ['Python'],
    submitRecruitment: true,
  })

  assert.equal(created.ok, true)
  assert.equal(created.data.id !== undefined, true)
  assert.equal(created.data.memberCount, 1)
  assert.equal(created.data.capacity, 4)
  assert.equal(created.data.membershipRole, 'Captain')
  assert.equal(created.data.canManageRecruitment, true)
  assert.equal(created.data.competitionTitle, competitions.open.title)
  teams.main = { id: created.data.id }
})

test('the unpublished recruitment never appears in the public list', { skip }, async () => {
  const recruitments = await api.listRecruitments(competitions.open.id)
  assert.equal(recruitments.some((item) => item.id === teams.main.id), false)

  await signIn(accounts.captain)
  const management = await api.getRecruitmentManagement(teams.main.id)
  assert.equal(management.ok, true)
  assert.equal(management.data.publication, 'Pending')
  assert.equal(management.data.draft !== undefined, true)
  assert.equal(management.data.draft.teamName, 'Signal Forge')
  assert.deepEqual(management.data.draft.requiredSkills, ['Python'])
  assert.equal(management.data.effective.requiredSkills.includes('Python'), true)
})

test('the administrator approves the recruitment revision and it becomes public', { skip: skipWithoutAdmin }, async () => {
  const queue = await adminRequest('GET', '/moderation/recruitments')
  const revision = queue.find((item) => item.teamId === teams.main.id)
  assert.equal(revision !== undefined, true)
  assert.equal(revision.status, 'Pending')

  const decision = await adminRequest('POST', `/moderation/recruitments/${revision.id}/decision`, {
    decision: 'Approved',
  })
  assert.equal(decision.status, 'Approved')
  assert.equal(decision.team.publication, 'Published')

  const recruitments = await api.listRecruitments(competitions.open.id)
  const published = recruitments.find((item) => item.id === teams.main.id)
  assert.equal(published !== undefined, true)
  assert.equal(published.availability, 'Open')
  assert.equal(published.memberCount, 1)
  assert.equal(published.capacity, 4)
})

test('the captain finds the team in My Teams', { skip }, async () => {
  await signIn(accounts.captain)
  const result = await api.listMyTeams()
  assert.equal(result.ok, true)
  const team = result.data.current.find((item) => item.id === teams.main.id)
  assert.equal(team !== undefined, true)
  assert.equal(team.membershipRole, 'Captain')
  assert.equal(team.publication, 'Published')
  assert.equal(team.canReviewApplications, true)
})

test('the applicant discovers the published recruitment', { skip }, async () => {
  await signIn(accounts.applicantB)
  const recruitments = await api.listRecruitments(competitions.open.id)
  const published = recruitments.find((item) => item.id === teams.main.id)
  assert.equal(published !== undefined, true)
  assert.equal(published.isPubliclyListed, true)
  assert.equal(published.matchStatus, 'Matched')
})

test('the applicant applies and the application is Pending', { skip }, async () => {
  await signIn(accounts.applicantB)
  const result = await api.applyToTeam(teams.main.id)
  assert.equal(result.ok, true)
  assert.equal(result.data.status, 'Pending')
  assert.equal(result.data.teamId, teams.main.id)
  teams.applicationB = { id: result.data.id }
})

test('a second Pending application from the same student is refused', { skip }, async () => {
  await signIn(accounts.applicantB)
  const result = await api.applyToTeam(teams.main.id)
  assert.equal(result.ok, false)
  assert.equal(result.code, 'DUPLICATE_PENDING')
})

test('the captain reviews the Pending application', { skip }, async () => {
  await signIn(accounts.captain)
  const result = await api.listCaptainApplications(teams.main.id)
  assert.equal(result.ok, true)
  assert.equal(result.data.length, 1)
  const pending = result.data[0]
  assert.equal(pending.id, teams.applicationB.id)
  assert.equal(pending.matchStatus, 'Matched')
  assert.equal(pending.applicant.name, 'Applicant B')
  assert.deepEqual(pending.applicant.skillTags, ['Python'])
})

test('a student who is not the captain cannot read the review queue', { skip }, async () => {
  await signIn(accounts.outsider)
  const result = await api.listCaptainApplications(teams.main.id)
  assert.equal(result.ok, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('a team id in the URL does not grant the captain scope', { skip }, async () => {
  await signIn(accounts.applicantC)
  const result = await api.listCaptainApplications(teams.main.id)
  assert.equal(result.ok, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('the captain approves and the applicant becomes an active member', { skip }, async () => {
  await signIn(accounts.captain)
  const result = await api.approveApplication(teams.applicationB.id)
  assert.equal(result.ok, true)

  await signIn(accounts.applicantB)
  const teamsOfApplicant = await api.listMyTeams()
  assert.equal(teamsOfApplicant.ok, true)
  const membership = teamsOfApplicant.data.current.find((item) => item.id === teams.main.id)
  assert.equal(membership !== undefined, true)
  assert.equal(membership.membershipRole, 'Member')
  assert.equal(membership.memberCount, 2)

  const operations = await api.getTeamOperations(teams.main.id)
  assert.equal(operations.ok, true)
  assert.equal(operations.data.members.length, 2)
})

test('an approved applicant cannot apply to a second team in the same competition', { skip }, async () => {
  // The second team belongs to another captain; the applicant is already a
  // member of the competition and may not join a second team there.
  await signIn(accounts.outsider)
  const second = await api.createTeam({
    competitionId: competitions.open.id,
    name: 'Second Signal',
    summary: 'A second team in the same competition.',
    capacity: 3,
    requiredSkills: ['Python'],
    submitRecruitment: true,
  })
  assert.equal(second.ok, true)
  teams.second = { id: second.data.id }

  const revision = (await adminRequest('GET', '/moderation/recruitments')).find(
    (item) => item.teamId === teams.second.id,
  )
  await adminRequest('POST', `/moderation/recruitments/${revision.id}/decision`, { decision: 'Approved' })

  await signIn(accounts.applicantB)
  const result = await api.applyToTeam(teams.second.id)
  assert.equal(result.ok, false)
  assert.equal(result.code, 'ALREADY_MEMBER')
})

test('a rejected application stays in the history', { skip }, async () => {
  await signIn(accounts.captain)
  const created = await api.createTeam({
    competitionId: competitions.reject.id,
    name: 'Reject Lane',
    summary: 'A team used for the rejection check.',
    capacity: 3,
    requiredSkills: ['CAD'],
    submitRecruitment: true,
  })
  assert.equal(created.ok, true)
  teams.reject = { id: created.data.id }

  const revision = (await adminRequest('GET', '/moderation/recruitments')).find(
    (item) => item.teamId === teams.reject.id,
  )
  await adminRequest('POST', `/moderation/recruitments/${revision.id}/decision`, { decision: 'Approved' })

  await signIn(accounts.applicantC)
  const applied = await api.applyToTeam(teams.reject.id)
  assert.equal(applied.ok, true)

  await signIn(accounts.captain)
  const rejected = await api.rejectApplication(applied.data.id)
  assert.equal(rejected.ok, true)

  await signIn(accounts.applicantC)
  const history = await api.listMyApplications()
  const record = history.data.find((item) => item.id === applied.data.id)
  assert.equal(record.status, 'Rejected')
  assert.equal(record.teamId, teams.reject.id)
  assert.equal(record.canReapply, true)
})

test('an application can be withdrawn and the history keeps the record', { skip }, async () => {
  await signIn(accounts.captain)
  const created = await api.createTeam({
    competitionId: competitions.withdraw.id,
    name: 'Withdraw Lane',
    summary: 'A team used for the withdrawal check.',
    capacity: 3,
    requiredSkills: ['Java'],
    submitRecruitment: true,
  })
  teams.withdraw = { id: created.data.id }

  const revision = (await adminRequest('GET', '/moderation/recruitments')).find(
    (item) => item.teamId === teams.withdraw.id,
  )
  await adminRequest('POST', `/moderation/recruitments/${revision.id}/decision`, { decision: 'Approved' })

  await signIn(accounts.applicantC)
  const applied = await api.applyToTeam(teams.withdraw.id)
  assert.equal(applied.ok, true)

  const withdrawn = await api.withdrawApplication(applied.data.id)
  assert.equal(withdrawn.ok, true)

  const history = await api.listMyApplications()
  const record = history.data.find((item) => item.id === applied.data.id)
  assert.equal(record.status, 'Withdrawn')
  assert.equal(record.canWithdraw, false)
  assert.equal(record.canReapply, true)
})

test('an incomplete profile cannot apply', { skip }, async () => {
  await signIn(accounts.incomplete)
  const result = await api.applyToTeam(teams.main.id)
  assert.equal(result.ok, false)
  assert.equal(result.code, 'PROFILE_INCOMPLETE')
  assert.equal(result.message.includes('Missing:'), true)
})

test('a Not Matched applicant may still apply', { skip }, async () => {
  await signIn(accounts.applicantC)
  const recruitments = await api.listRecruitments(competitions.open.id)
  const main = recruitments.find((item) => item.id === teams.main.id)
  assert.equal(main.matchStatus, 'NotMatched')
  assert.equal(main.availability, 'Open')

  // A skill overlap is guidance only; the server still accepts the application.
  const result = await api.applyToTeam(teams.main.id)
  assert.equal(result.ok, true)
  assert.equal(result.data.status, 'Pending')
})

test('a non-member cannot read the protected contact details', { skip }, async () => {
  await signIn(accounts.outsider)
  const result = await api.getActiveMemberContacts(teams.main.id)
  assert.equal(result.ok, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('a member who is not the captain cannot read the protected contact details', { skip }, async () => {
  await signIn(accounts.applicantB)
  const result = await api.getActiveMemberContacts(teams.main.id)
  assert.equal(result.ok, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('the captain reads the contact details of an active member', { skip }, async () => {
  await signIn(accounts.captain)
  const result = await api.getActiveMemberContacts(teams.main.id)
  assert.equal(result.ok, true)
  assert.equal(result.data.length, 1)
  assert.equal(result.data[0].memberName, accounts.applicantB.username)
  assert.equal(result.data[0].wechatId, 'applicant_b_wechat')
})

test('the application history survives a reload and comes from the API', { skip }, async () => {
  await signIn(accounts.applicantB)
  const first = await api.listMyApplications()
  assert.equal(first.ok, true)
  assert.equal(first.data.some((item) => item.id === teams.applicationB.id), true)

  const second = await api.listMyApplications()
  assert.deepEqual(
    second.data.map((item) => item.id).sort(),
    first.data.map((item) => item.id).sort(),
  )
  const approved = first.data.find((item) => item.id === teams.applicationB.id)
  assert.equal(approved.status, 'Approved')
  assert.equal(approved.isCurrentMembership, true)
})

test('the recruitment switch closes and reopens the applications', { skip }, async () => {
  await signIn(accounts.captain)
  const closed = await api.setRecruitmentSwitch(teams.main.id, 'Closed')
  assert.equal(closed.ok, true)
  assert.equal(closed.data.recruitmentSwitch, 'Closed')

  const recruitments = await api.listRecruitments(competitions.open.id)
  const main = recruitments.find((item) => item.id === teams.main.id)
  assert.equal(main.availability, 'ManuallyClosed')

  await signIn(accounts.applicantC)
  const refused = await api.applyToTeam(teams.main.id)
  assert.equal(refused.ok, false)
  assert.equal(refused.code, 'RECRUITMENT_CLOSED')
})

test('a delisted recruitment disappears from the public list', { skip: skipWithoutAdmin }, async () => {
  await signIn(accounts.captain)
  const created = await api.createTeam({
    competitionId: competitions.delist.id,
    name: 'Delist Lane',
    summary: 'A team used for the delisting check.',
    capacity: 3,
    requiredSkills: ['CAD'],
    submitRecruitment: true,
  })
  teams.delist = { id: created.data.id }

  const revision = (await adminRequest('GET', '/moderation/recruitments')).find(
    (item) => item.teamId === teams.delist.id,
  )
  await adminRequest('POST', `/moderation/recruitments/${revision.id}/decision`, { decision: 'Approved' })

  const before = await api.listRecruitments(competitions.delist.id)
  assert.equal(before.some((item) => item.id === teams.delist.id), true)

  await adminRequest('DELETE', `/moderation/recruitments/team/${teams.delist.id}`)

  const after = await api.listRecruitments(competitions.delist.id)
  assert.equal(after.some((item) => item.id === teams.delist.id), false)

  await signIn(accounts.captain)
  const detail = await api.getRecruitment(teams.delist.id)
  assert.equal(detail.publication, 'Delisted')
  assert.equal(detail.availability, 'Delisted')
})

test('approving beyond the capacity is refused', { skip: skipWithoutAdmin }, async () => {
  await signIn(accounts.captain)
  const created = await api.createTeam({
    competitionId: competitions.capacity.id,
    name: 'Capacity Lane',
    summary: 'A team with a captain and a single free slot.',
    capacity: 2,
    requiredSkills: ['Python'],
    submitRecruitment: true,
  })
  assert.equal(created.ok, true)
  teams.capacity = { id: created.data.id }

  const revision = (await adminRequest('GET', '/moderation/recruitments')).find(
    (item) => item.teamId === teams.capacity.id,
  )
  await adminRequest('POST', `/moderation/recruitments/${revision.id}/decision`, { decision: 'Approved' })

  await signIn(accounts.applicantB)
  const first = await api.applyToTeam(teams.capacity.id)
  assert.equal(first.ok, true)
  await signIn(accounts.applicantC)
  const second = await api.applyToTeam(teams.capacity.id)
  assert.equal(second.ok, true)

  await signIn(accounts.captain)
  const approved = await api.approveApplication(first.data.id)
  assert.equal(approved.ok, true)

  const refused = await api.approveApplication(second.data.id)
  assert.equal(refused.ok, false)
  assert.equal(refused.code, 'TEAM_FULL')

  const operations = await api.getTeamOperations(teams.capacity.id)
  assert.equal(operations.ok, true)
  assert.equal(operations.data.members.length, 2)
})

test('the last slot can only be taken once when two approvals race', { skip: skipWithoutAdmin }, async () => {
  await signIn(accounts.captain)
  const created = await api.createTeam({
    competitionId: competitions.race.id,
    name: 'Race Lane',
    summary: 'A team with a captain and a single free slot.',
    capacity: 2,
    requiredSkills: ['Python'],
    submitRecruitment: true,
  })
  assert.equal(created.ok, true)
  teams.race = { id: created.data.id }

  const revision = (await adminRequest('GET', '/moderation/recruitments')).find(
    (item) => item.teamId === teams.race.id,
  )
  await adminRequest('POST', `/moderation/recruitments/${revision.id}/decision`, { decision: 'Approved' })

  await signIn(accounts.applicantB)
  const first = await api.applyToTeam(teams.race.id)
  await signIn(accounts.applicantC)
  const second = await api.applyToTeam(teams.race.id)
  assert.equal(first.ok, true)
  assert.equal(second.ok, true)

  await signIn(accounts.captain)
  const results = await Promise.all([
    api.approveApplication(first.data.id),
    api.approveApplication(second.data.id),
  ])

  const succeeded = results.filter((result) => result.ok)
  const refused = results.filter((result) => !result.ok)
  assert.equal(succeeded.length, 1)
  assert.equal(refused.length, 1)
  assert.equal(refused[0].code, 'TEAM_FULL')

  const operations = await api.getTeamOperations(teams.race.id)
  assert.equal(operations.ok, true)
  assert.equal(operations.data.members.length, 2)
  assert.equal(
    operations.data.members.filter((member) => member.role === 'Captain').length,
    1,
  )
})

test('the run records its identifiers for the database read-back', { skip }, async () => {
  const summary = {
    competitionId: competitions.open.id,
    teamId: teams.main.id,
    applicationId: teams.applicationB.id,
    captain: accounts.captain.username,
    applicant: accounts.applicantB.username,
    outsider: accounts.outsider.username,
    capacityTeamId: teams.capacity.id,
    raceTeamId: teams.race.id,
  }
  await writeFile('../../.tools/t4-run-summary.json', JSON.stringify(summary, null, 2), 'utf8')
  assert.equal(Object.values(summary).every((value) => value !== ''), true)
})
