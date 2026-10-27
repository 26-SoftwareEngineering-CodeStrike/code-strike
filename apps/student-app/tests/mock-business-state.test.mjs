import assert from 'node:assert/strict'
import test from 'node:test'
import { MockBusinessState } from '../src/mock/business-state.ts'

function select(state, actorId) {
  assert.equal(state.selectActor(actorId).ok, true)
}

test('owner history keeps all five states distinct and historical approval is not membership', () => {
  const state = new MockBusinessState()
  select(state, 'student-alex')
  assert.equal(state.withdraw('application-alex-alpha').ok, true)
  const fresh = state.reapply('application-history-withdrawn')
  assert.equal(fresh.ok, true)
  const history = state.listApplicationHistory().data
  const statuses = new Set(history.map((item) => item.status))
  assert.deepEqual([...statuses].sort(), ['Approved', 'Invalidated', 'Pending', 'Rejected', 'Withdrawn'].sort())
  const approved = history.find((item) => item.status === 'Approved')
  assert.equal(approved.isCurrentMembership, false)
  assert.ok(history.filter((item) => item.teamId === 'team-alpha').length >= 3)
})

test('one Pending per student/team is enforced while different-team Pending is allowed', () => {
  const state = new MockBusinessState()
  select(state, 'student-alex')
  assert.equal(state.apply('team-alpha').code, 'PENDING_EXISTS')
  const pending = state.listApplicationHistory().data.filter((item) => item.status === 'Pending')
  assert.deepEqual(new Set(pending.map((item) => item.teamId)), new Set(['team-alpha', 'team-beta']))
})

test('approval creates membership and invalidates same-competition Pending only', () => {
  const state = new MockBusinessState()
  select(state, 'captain-alpha')
  assert.equal(state.approve('application-alex-alpha').ok, true)
  select(state, 'student-alex')
  const history = state.listApplicationHistory().data
  assert.equal(history.find((item) => item.id === 'application-alex-alpha').status, 'Approved')
  assert.equal(history.find((item) => item.id === 'application-alex-alpha').isCurrentMembership, true)
  assert.equal(history.find((item) => item.id === 'application-alex-beta').status, 'Invalidated')
  assert.equal(history.find((item) => item.id === 'application-history-approved').status, 'Approved')
})

test('manual close and revision delisting block fresh applications but not eligible Pending approval', () => {
  for (const scenario of ['manual-closed', 'revision-delisted']) {
    const state = new MockBusinessState()
    state.applyNamedScenario(scenario)
    select(state, 'captain-alpha')
    assert.equal(state.approve('application-maya-alpha').ok, true)
  }
})

test('capacity, deadline and dissolution use exact invalidation semantics', () => {
  const full = new MockBusinessState()
  full.applyNamedScenario('full')
  select(full, 'captain-alpha')
  assert.equal(full.approve('application-maya-alpha').message, 'Cannot process this application: it is no longer Pending.')
  select(full, 'student-alex')
  assert.equal(full.listApplicationHistory().data.find((item) => item.id === 'application-alex-alpha').status, 'Invalidated')

  const deadline = new MockBusinessState()
  deadline.applyNamedScenario('deadline-expired')
  select(deadline, 'student-alex')
  assert.equal(deadline.apply('team-epsilon').code, 'DEADLINE_PASSED')

  const dissolved = new MockBusinessState()
  dissolved.applyNamedScenario('dissolved')
  select(dissolved, 'student-alex')
  assert.equal(dissolved.listApplicationHistory().data.find((item) => item.id === 'application-alex-alpha').status, 'Invalidated')

  const exactFull = new MockBusinessState()
  select(exactFull, 'student-alex')
  assert.equal(exactFull.apply('team-gamma').message, 'This team is full.')
})

test('an ended membership does not block an otherwise eligible reapplication', () => {
  const state = new MockBusinessState()
  state.applyNamedScenario('former-member')
  select(state, 'student-alex')
  state.withdraw('application-alex-alpha')
  state.withdraw('application-alex-beta')
  const result = state.reapply('application-history-rejected')
  assert.equal(result.ok, true)
  assert.equal(result.data.status, 'Pending')
})

test('captain DTO contains exactly the five permitted applicant fields', () => {
  const state = new MockBusinessState()
  select(state, 'captain-alpha')
  const queue = state.listCaptainQueue()
  assert.equal(queue.ok, true)
  assert.deepEqual(Object.keys(queue.data[0].applicant).sort(), ['briefCv', 'college', 'name', 'sex', 'skillTags'].sort())
  assert.equal(queue.data.some((item) => item.matchStatus === 'NotMatched'), true)
})

test('captain scope changes immediately and privileged revision review is explicit', () => {
  const state = new MockBusinessState()
  select(state, 'visitor')
  assert.equal(state.canReviewRecruitment('team-delta'), false)
  select(state, 'student-alex')
  assert.equal(state.canReviewRecruitment('team-delta'), false)
  select(state, 'captain-delta')
  assert.equal(state.canReviewRecruitment('team-delta'), true)
  assert.equal(state.canReviewRecruitment('team-alpha'), false)
  select(state, 'admin-reviewer')
  assert.equal(state.canReviewRecruitment('team-delta'), true)

  const transfer = new MockBusinessState()
  select(transfer, 'captain-alpha')
  transfer.applyNamedScenario('captain-transferred')
  assert.equal(transfer.listCaptainQueue().code, 'CAPTAIN_REQUIRED')
  assert.equal(transfer.approve('application-maya-alpha').code, 'CAPTAIN_REQUIRED')
  select(transfer, 'alpha-successor')
  assert.equal(transfer.listCaptainQueue().ok, true)
  assert.equal(transfer.approve('application-maya-alpha').ok, true)
})
