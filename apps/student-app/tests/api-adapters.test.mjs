import assert from 'node:assert/strict'
import test from 'node:test'
import {
  deriveCoverTone,
  toActiveMemberContact,
  toApplicationSummary,
  toCaptainPendingApplication,
  toCompetitionDetail,
  toCompetitionSummary,
  toDashboard,
  toPendingApplicantProfile,
  toPlannerOccurrence,
  toRecruitmentAvailability,
  toRecruitmentDetail,
  toRecruitmentSummary,
  toSkillMatchStatus,
  toTeamMemberView,
} from '@codestrike/contracts'

const competitionDto = {
  id: 'competition-1',
  title: '2026 University Innovation Challenge',
  category: 'Innovation',
  registrationDeadline: '2026-12-15T16:00:00Z',
  deadlineStatus: 'BeforeDeadline',
  description: 'A campus innovation challenge.',
  eligibilityRules: 'Open to enrolled university students. Cross-major teams are welcome.',
  maxTeamSize: 4,
  officialSourceUrl: 'https://example.edu/innovation-challenge',
  coverImage: null,
  published: true,
  communityId: 'community-1',
}

function teamDto(overrides = {}) {
  return {
    id: 'team-alpha',
    competitionId: 'competition-1',
    name: 'Team Alpha',
    summary: 'Building an accessible campus navigation concept.',
    memberCount: 2,
    capacity: 4,
    lifecycle: 'Active',
    publication: 'Published',
    recruitmentSwitch: 'Open',
    skills: [{ id: 'skill-1', name: 'Python' }, { id: 'skill-2', name: 'Java' }],
    captainUsername: 'orbit_captain',
    match: 'Matched',
    ...overrides,
  }
}

test('a competition DTO becomes a competition summary with a deterministic cover tone', () => {
  const summary = toCompetitionSummary(competitionDto)

  assert.equal(summary.id, 'competition-1')
  assert.equal(summary.title, '2026 University Innovation Challenge')
  assert.equal(summary.deadlineStatus, 'BeforeDeadline')
  assert.equal(summary.eligibilitySummary.startsWith('Open to enrolled university students.'), true)
  assert.equal(summary.coverTone, deriveCoverTone('competition-1'))
  assert.equal(summary.coverTone, toCompetitionSummary(competitionDto).coverTone)
})

test('a competition DTO becomes a competition detail and reports the community counts it was given', () => {
  const detail = toCompetitionDetail(competitionDto)

  assert.equal(detail.eligibility, competitionDto.eligibilityRules)
  assert.equal(detail.maximumTeamSize, 4)
  assert.equal(detail.officialSourceUrl, 'https://example.edu/innovation-challenge')
  assert.deepEqual(detail.community, {
    discussionCount: 0,
    resourceCount: 0,
    publishedRecruitmentCount: 0,
  })

  const counted = toCompetitionDetail(competitionDto, { publishedRecruitmentCount: 3 })
  assert.equal(counted.community.publishedRecruitmentCount, 3)
})

test('the backend match spelling is normalised for the view model', () => {
  assert.equal(toSkillMatchStatus('Matched'), 'Matched')
  assert.equal(toSkillMatchStatus('Not Matched'), 'NotMatched')
  assert.equal(toSkillMatchStatus(null), 'NotMatched')
})

test('recruitment availability follows publication, deadline, switch and capacity', () => {
  assert.equal(toRecruitmentAvailability(teamDto()), 'Open')
  assert.equal(toRecruitmentAvailability(teamDto({ memberCount: 4 })), 'Full')
  assert.equal(toRecruitmentAvailability(teamDto({ recruitmentSwitch: 'Closed' })), 'ManuallyClosed')
  assert.equal(toRecruitmentAvailability(teamDto({ publication: 'Delisted' })), 'Delisted')
  assert.equal(toRecruitmentAvailability(teamDto({ lifecycle: 'Dissolved' })), 'Delisted')
  assert.equal(toRecruitmentAvailability(teamDto(), { deadlinePassed: true }), 'RegistrationClosed')
})

test('a team DTO becomes a recruitment summary with its skill names', () => {
  const summary = toRecruitmentSummary(teamDto())

  assert.equal(summary.name, 'Team Alpha')
  assert.deepEqual(summary.requiredSkills, ['Python', 'Java'])
  assert.equal(summary.matchStatus, 'Matched')
  assert.equal(summary.availability, 'Open')
  assert.equal(summary.isPubliclyListed, true)
  assert.equal(summary.captainUsername, 'orbit_captain')
  assert.equal(summary.competitionId, 'competition-1')
})

test('a recruitment detail keeps the competition context it was given', () => {
  const detail = toRecruitmentDetail(teamDto(), {
    competitionTitle: '2026 University Innovation Challenge',
    competitionDeadline: '2026-12-15T16:00:00Z',
  })

  assert.equal(detail.competitionTitle, '2026 University Innovation Challenge')
  assert.equal(detail.competitionDeadline, '2026-12-15T16:00:00Z')
  assert.equal('revisionDraft' in detail, false)
})

test('member, contact and application DTOs become their view models', () => {
  const member = toTeamMemberView({
    id: 'membership-1',
    userId: 'user-1',
    teamId: 'team-alpha',
    username: 'orbit_captain',
    status: 'Active',
    role: 'Captain',
  })
  assert.deepEqual(member, {
    membershipId: 'membership-1',
    username: 'orbit_captain',
    role: 'Captain',
    status: 'Active',
  })

  const contact = toActiveMemberContact(
    { userId: 'user-1', wechatId: 'wechat-id', qqId: null },
    { membershipId: 'membership-1', memberName: 'orbit_captain' },
  )
  assert.equal(contact.wechatId, 'wechat-id')
  assert.equal(contact.qqId, undefined)

  const application = toApplicationSummary({
    id: 'application-1',
    competitionId: 'competition-1',
    teamId: 'team-alpha',
    teamName: 'Team Alpha',
    status: 'Pending',
    reason: 'I can build the frontend.',
    createdAt: '2026-11-20T10:00:00',
    decidedAt: null,
  })
  assert.equal(application.reason, 'I can build the frontend.')
  assert.equal(application.status, 'Pending')
})

test('an applicant preview keeps exactly the five permitted fields', () => {
  const profile = toPendingApplicantProfile({
    name: 'Alex',
    college: 'Computer Science',
    sex: 'Female',
    skills: [{ id: 'skill-1', name: 'Python' }],
    briefCv: 'Built two course projects.',
  })

  assert.deepEqual(Object.keys(profile).sort(), ['briefCv', 'college', 'name', 'sex', 'skillTags'].sort())
  assert.deepEqual(profile.skillTags, ['Python'])

  const empty = toPendingApplicantProfile({
    name: null,
    college: null,
    sex: null,
    skills: [],
    briefCv: null,
  })
  assert.equal(empty.name, '')
  assert.deepEqual(empty.skillTags, [])
})

test('a review DTO becomes a captain pending application', () => {
  const review = toCaptainPendingApplication({
    id: 'application-1',
    competitionId: 'competition-1',
    teamId: 'team-alpha',
    teamName: 'Team Alpha',
    status: 'Pending',
    reason: null,
    createdAt: '2026-11-20T10:00:00',
    decidedAt: null,
    applicant: {
      name: 'Alex',
      college: 'Computer Science',
      sex: 'Female',
      skills: [{ id: 'skill-1', name: 'Vue' }],
      briefCv: 'Built two course projects.',
    },
    match: 'Not Matched',
    highlightName: false,
  })

  assert.equal(review.matchStatus, 'NotMatched')
  assert.equal(review.submittedDate, '2026-11-20T10:00:00')
  assert.equal(review.applicant.skillTags[0], 'Vue')
})

test('a planner item DTO becomes a planner occurrence', () => {
  const occurrence = toPlannerOccurrence({
    id: 'item-1',
    recurrenceId: 'batch-1',
    kind: 'Course',
    title: 'Linear Algebra',
    date: '2026-10-26',
    startTime: '08:00:00',
    endTime: '09:40:00',
    startWeek: 1,
    weekday: 1,
    startPeriod: 1,
    endPeriod: 2,
    room: 'Room 301',
    description: null,
    deadline: null,
    completed: false,
    createdAt: '2026-10-20T08:00:00',
    updatedAt: '2026-10-20T08:00:00',
  })

  assert.equal(occurrence.type, 'Course')
  assert.equal(occurrence.actualDate, '2026-10-26')
  assert.equal(occurrence.batchId, 'batch-1')
  assert.equal(occurrence.startTime, '08:00:00')
  assert.equal(occurrence.description, undefined)
})

test('the dashboard DTO becomes the dashboard view model', () => {
  const dashboard = toDashboard({
    competitionCount: 2,
    pendingApplicationCount: 5,
    activeTeamCount: 3,
    moderationCount: 1,
    competitions: [competitionDto],
  })

  assert.equal(dashboard.competitionCount, 2)
  assert.equal(dashboard.pendingApplicationCount, 5)
  assert.equal(dashboard.activeTeamCount, 3)
  assert.equal(dashboard.moderationCount, 1)
  assert.equal(dashboard.competitions.length, 1)
  assert.equal(dashboard.competitions[0].id, 'competition-1')
})
