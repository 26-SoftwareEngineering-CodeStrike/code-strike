import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '@codestrike/contracts/http'
import { createStudentApiClient } from '../src/api/client.ts'

/**
 * T4 route mapping. These checks pin the wire contract between the student
 * client and the FastAPI backend: which route is called, what the body looks
 * like and how the answer is turned into a view model. They run without a
 * backend; the end-to-end suite proves the same calls against real MySQL.
 */

function recordingTransport(responses) {
  const calls = []
  return {
    calls,
    async request(request) {
      calls.push(request)
      const responder = responses[request.path]
      if (!responder) throw new Error(`Unexpected request to ${request.path}`)
      return responder(request)
    },
  }
}

const skillCatalog = [
  { id: 'skill-python', name: 'Python' },
  { id: 'skill-java', name: 'Java' },
]

const signedInUser = { id: 'user-captain', username: 'captain_one', role: 'Student', email: null }

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

const team = {
  id: 'team-1',
  competitionId: 'competition-1',
  name: 'Signal Forge',
  summary: 'A campus navigation concept.',
  memberCount: 1,
  capacity: 4,
  lifecycle: 'Active',
  publication: 'Published',
  recruitmentSwitch: 'Open',
  skills: [{ id: 'skill-python', name: 'Python' }],
  captainUsername: 'captain_one',
  match: null,
}

function teamCreated(overrides = {}) {
  return {
    ...team,
    publication: 'Pending',
    ...overrides,
    revision: {
      id: 'revision-1',
      teamId: 'team-1',
      status: 'Pending',
      publication: 'Pending',
      proposed: { name: 'Signal Forge', summary: 'A campus navigation concept.', capacity: 4, skillIds: ['skill-python'] },
    },
  }
}

test('creating a team sends the skill ids of the administrator catalogue', async () => {
  const transport = recordingTransport({
    '/skills': () => skillCatalog,
    '/teams': (request) => {
      assert.equal(request.method, 'POST')
      return teamCreated()
    },
    '/competitions': () => [competition],
    '/teams/team-1/members': () => [
      { id: 'membership-1', userId: 'user-captain', teamId: 'team-1', username: 'captain_one', status: 'Active', role: 'Captain' },
    ],
    '/auth/me': () => signedInUser,
  })
  const api = createStudentApiClient({ mode: 'api', transport })

  const result = await api.createTeam({
    competitionId: 'competition-1',
    name: 'Signal Forge',
    summary: 'A campus navigation concept.',
    capacity: 4,
    requiredSkills: ['Python'],
    submitRecruitment: true,
  })

  assert.equal(result.ok, true)
  const body = transport.calls.find((call) => call.path === '/teams').body
  assert.deepEqual(body, {
    competitionId: 'competition-1',
    name: 'Signal Forge',
    summary: 'A campus navigation concept.',
    capacity: 4,
    skillIds: ['skill-python'],
    submitRecruitment: true,
  })
  assert.equal(result.data.id, 'team-1')
  assert.equal(result.data.membershipRole, 'Captain')
  assert.equal(result.data.canManageRecruitment, true)
  assert.equal(result.data.competitionTitle, '2026 University Innovation Challenge')
})

test('a skill name outside the catalogue is refused before the request is sent', async () => {
  const transport = recordingTransport({ '/skills': () => skillCatalog })
  const api = createStudentApiClient({ mode: 'api', transport })

  const result = await api.createTeam({
    competitionId: 'competition-1',
    name: 'Signal Forge',
    summary: 'A campus navigation concept.',
    capacity: 4,
    requiredSkills: ['Figma'],
    submitRecruitment: false,
  })

  assert.equal(result.ok, false)
  assert.equal(result.code, 'INVALID_SKILLS')
  assert.equal(transport.calls.some((call) => call.path === '/teams'), false)
})

test('the captain decision uses the Approved and Rejected vocabulary', async () => {
  const transport = recordingTransport({
    '/applications/application-1/decision': (request) => {
      assert.equal(request.method, 'POST')
      return { id: 'application-1', status: request.body.decision }
    },
  })
  const api = createStudentApiClient({ mode: 'api', transport })

  const approved = await api.approveApplication('application-1')
  assert.equal(approved.ok, true)
  assert.deepEqual(transport.calls[0].body, { decision: 'Approved' })

  const rejected = await api.rejectApplication('application-1')
  assert.equal(rejected.ok, true)
  assert.deepEqual(transport.calls[1].body, { decision: 'Rejected' })
})

test('the recruitment switch uses the state vocabulary', async () => {
  const transport = recordingTransport({
    '/teams/team-1/recruitment/switch': (request) => {
      assert.equal(request.method, 'PUT')
      return team
    },
    '/teams/team-1': () => team,
    '/competitions/competition-1': () => competition,
    '/teams/team-1/recruitment/revisions': () => [],
    '/skills': () => skillCatalog,
  })
  const api = createStudentApiClient({ mode: 'api', transport })

  await api.setRecruitmentSwitch('team-1', 'Closed')

  assert.deepEqual(transport.calls[0].body, { state: 'Closed' })
})

test('a recruitment revision is submitted with skill ids', async () => {
  const transport = recordingTransport({
    '/skills': () => skillCatalog,
    '/teams/team-1/recruitment/revisions': (request) => {
      if (request.method !== 'POST') return []
      assert.deepEqual(request.body, {
        name: 'Signal Forge',
        summary: 'A campus navigation concept.',
        capacity: 3,
        skillIds: ['skill-python'],
      })
      return { id: 'revision-2', status: 'Pending' }
    },
    '/teams/team-1': () => team,
    '/competitions/competition-1': () => competition,
  })
  const api = createStudentApiClient({ mode: 'api', transport })

  const result = await api.submitRecruitmentRevision('team-1', {
    teamName: 'Signal Forge',
    summary: 'A campus navigation concept.',
    capacity: 3,
    requiredSkills: ['Python'],
  })

  assert.equal(result.ok, true)
  assert.equal(result.data.effective.capacity, 4)
  assert.deepEqual(result.data.effective.requiredSkills, ['Python'])
})

test('applying, withdrawing and reapplying use the application routes', async () => {
  const transport = recordingTransport({
    '/teams/team-1/applications': (request) => {
      assert.equal(request.method, 'POST')
      return {
        id: 'application-1',
        competitionId: 'competition-1',
        teamId: 'team-1',
        teamName: 'Signal Forge',
        status: 'Pending',
        reason: null,
        createdAt: '2026-11-23T10:00:00',
        decidedAt: null,
      }
    },
    '/applications/application-1/withdraw': (request) => {
      assert.equal(request.method, 'POST')
      return { id: 'application-1', status: 'Withdrawn' }
    },
    '/competitions': () => [competition],
    '/me/applications': () => [
      {
        id: 'application-1',
        competitionId: 'competition-1',
        teamId: 'team-1',
        teamName: 'Signal Forge',
        status: 'Rejected',
        reason: 'Not this round.',
        createdAt: '2026-11-22T10:00:00',
        decidedAt: '2026-11-23T09:00:00',
      },
    ],
  })
  const api = createStudentApiClient({ mode: 'api', transport })

  const applied = await api.applyToTeam('team-1')
  assert.equal(applied.ok, true)
  assert.equal(applied.data.status, 'Pending')
  assert.equal(applied.data.canWithdraw, true)

  const withdrawn = await api.withdrawApplication('application-1')
  assert.equal(withdrawn.ok, true)

  const reapplied = await api.reapply('application-1')
  assert.equal(reapplied.ok, true)
  assert.equal(reapplied.data.status, 'Pending')
  assert.equal(transport.calls.filter((call) => call.path === '/teams/team-1/applications').length, 2)
})

test('the captain queue is read from the team application route', async () => {
  const transport = recordingTransport({
    '/teams/team-1/applications': () => [
      {
        id: 'application-1',
        competitionId: 'competition-1',
        teamId: 'team-1',
        teamName: 'Signal Forge',
        status: 'Pending',
        reason: null,
        createdAt: '2026-11-23T10:00:00',
        decidedAt: null,
        applicant: {
          name: 'Alex Chen',
          college: 'School of Computer Science',
          sex: 'Female',
          skills: [{ id: 'skill-python', name: 'Python' }],
          briefCv: 'Built two course projects.',
        },
        match: 'Not Matched',
        highlightName: true,
      },
    ],
  })
  const api = createStudentApiClient({ mode: 'api', transport })

  const result = await api.listCaptainApplications('team-1')

  assert.equal(result.ok, true)
  assert.equal(result.data.length, 1)
  assert.equal(result.data[0].matchStatus, 'NotMatched')
  assert.deepEqual(result.data[0].applicant.skillTags, ['Python'])
})

test('the captain queue needs a team and never reads another team by accident', async () => {
  const api = createStudentApiClient({ mode: 'api', transport: recordingTransport({}) })

  const result = await api.listCaptainApplications()

  assert.equal(result.ok, false)
  assert.equal(result.code, 'TEAM_REQUIRED')
})

test('the member contact route is addressed by the user id', async () => {
  const transport = recordingTransport({
    '/teams/team-1/members': () => [
      { id: 'membership-1', userId: 'user-captain', teamId: 'team-1', username: 'captain_one', status: 'Active', role: 'Captain' },
      { id: 'membership-2', userId: 'user-member', teamId: 'team-1', username: 'member_one', status: 'Active', role: 'Member' },
    ],
    '/teams/team-1/members/user-member/contact': () => ({ userId: 'user-member', wechatId: 'wechat-one', qqId: null }),
  })
  const api = createStudentApiClient({ mode: 'api', transport })

  const result = await api.getActiveMemberContacts('team-1')

  assert.equal(result.ok, true)
  assert.equal(result.data.length, 1)
  assert.equal(result.data[0].membershipId, 'user-member')
  assert.equal(result.data[0].wechatId, 'wechat-one')
  assert.equal(
    transport.calls.some((call) => call.path === '/teams/team-1/members/user-captain/contact'),
    false,
  )
})

test('the team history is read from the membership history route', async () => {
  const transport = recordingTransport({
    '/me/teams': () => [team],
    '/me/team-history': () => [
      {
        id: 'membership-9',
        teamId: 'team-old',
        teamName: 'Old Team',
        competitionId: 'competition-1',
        status: 'Ended',
        joinedAt: '2026-09-01T10:00:00',
        endedAt: '2026-10-01T10:00:00',
        reason: 'Left team.',
        lifecycle: 'Active',
        publication: 'Published',
        recruitmentSwitch: 'Open',
        capacity: 4,
        captainUsername: 'captain_one',
        memberCount: 2,
        role: 'Captain',
      },
    ],
    '/competitions': () => [competition],
    '/teams/team-1/members': () => [
      { id: 'membership-1', userId: 'user-captain', teamId: 'team-1', username: 'captain_one', status: 'Active', role: 'Captain' },
    ],
    '/auth/me': () => signedInUser,
  })
  const api = createStudentApiClient({ mode: 'api', transport })

  const result = await api.listMyTeams()

  assert.equal(result.ok, true)
  assert.equal(result.data.current.length, 1)
  assert.equal(result.data.current[0].membershipId, 'membership-1')
  assert.equal(result.data.history.length, 1)
  assert.equal(result.data.history[0].id, 'team-old')
  assert.equal(result.data.history[0].canManageRecruitment, false)
  assert.equal(result.data.history[0].canLeave, false)
})

test('a refused request is reported with the backend code and message', async () => {
  const transport = {
    calls: [],
    async request(request) {
      this.calls.push(request)
      throw new ApiError('You already belong to a team in this competition.', {
        kind: 'http',
        status: 409,
        code: 'ALREADY_MEMBER',
      })
    },
  }
  const api = createStudentApiClient({ mode: 'api', transport })

  const result = await api.createTeam({
    competitionId: 'competition-1',
    name: 'Signal Forge',
    summary: 'A campus navigation concept.',
    capacity: 4,
    requiredSkills: ['Python'],
    submitRecruitment: false,
  })

  assert.equal(result.ok, false)
  assert.equal(result.code, 'ALREADY_MEMBER')
  assert.equal(result.message, 'You already belong to a team in this competition.')
})
