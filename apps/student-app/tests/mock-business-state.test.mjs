import assert from 'node:assert/strict'
import test from 'node:test'
import { MockBusinessState } from '../src/mock/business-state.ts'

function select(state, actorId) {
  assert.equal(state.selectActor(actorId).ok, true)
}

test('dynamic Published to Delisted transition immediately closes public list and detail', () => {
  const state = new MockBusinessState()
  assert.equal(state.listPublicRecruitments('competition-demo-1').some((item) => item.id === 'team-alpha'), true)
  const publicBefore = state.getPublicRecruitment('team-alpha')
  assert.equal(publicBefore.ok, true)
  assert.equal('revisionDraft' in publicBefore.data, false)

  select(state, 'captain-alpha')
  const submitted = state.submitRecruitmentRevision('team-alpha', {
    teamName: 'Team Alpha Next', summary: 'Draft settings must remain isolated.', capacity: 4, requiredSkills: ['Python'],
  })
  assert.equal(submitted.ok, true)
  assert.equal(state.listPublicRecruitments('competition-demo-1').some((item) => item.id === 'team-alpha'), false)
  assert.equal(state.getPublicRecruitment('team-alpha').code, 'PUBLIC_RECRUITMENT_NOT_FOUND')
  const review = state.getRecruitmentReview('team-alpha')
  assert.equal(review.ok, true)
  assert.equal(review.data.name, 'Team Alpha')
  assert.equal(review.data.revisionDraft.teamName, 'Team Alpha Next')

  select(state, 'student-alex')
  assert.equal(state.getRecruitmentReview('team-alpha').code, 'REVIEW_DENIED')
})

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

test('incomplete profile cannot create a Pending application or alter history', () => {
  const state = new MockBusinessState()
  select(state, 'student-incomplete')
  const before = state.listApplicationHistory().data
  assert.equal(before.filter((item) => item.status === 'Pending').length, 0)
  assert.equal(state.apply('team-beta').code, 'PROFILE_INCOMPLETE')
  const after = state.listApplicationHistory().data
  assert.deepEqual(after, before)
  assert.equal(after.filter((item) => item.status === 'Pending').length, 0)
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

test('team creation validates profile and deadline then creates captain membership', () => {
  const state = new MockBusinessState()
  select(state, 'student-incomplete')
  assert.equal(state.createTeam({ competitionId: 'competition-demo-1', name: 'Incomplete', summary: 'Blocked', capacity: 3, requiredSkills: ['Vue'], submitRecruitment: false }).code, 'PROFILE_INCOMPLETE')
  select(state, 'student-alex')
  assert.equal(state.createTeam({ competitionId: 'competition-demo-2', name: 'Late', summary: 'Blocked', capacity: 3, requiredSkills: ['Python'], submitRecruitment: false }).code, 'DEADLINE_PASSED')
  const created = state.createTeam({ competitionId: 'competition-demo-1', name: 'Signal Forge', summary: 'A fictional cross-major prototype team.', capacity: 4, requiredSkills: ['Python', 'Research'], submitRecruitment: true })
  assert.equal(created.ok, true)
  assert.equal(created.data.membershipRole, 'Captain')
  assert.equal(created.data.membershipStatus, 'Active')
  assert.equal(created.data.publication, 'Pending')
  assert.equal(created.data.memberCount, 1)
  assert.equal(state.getActor().role, 'CurrentCaptain')
  const history = state.listApplicationHistory().data
  assert.equal(history.filter((item) => item.competitionId === 'competition-demo-1' && item.status === 'Pending').length, 0)
})

test('recruitment draft stays separate until isolated admin approval', () => {
  const state = new MockBusinessState()
  select(state, 'captain-alpha')
  assert.equal(state.submitRecruitmentRevision('team-alpha', { teamName: 'Alpha Revised', summary: 'New draft copy.', capacity: 3, requiredSkills: ['Research'] }).ok, true)
  const captainView = state.getRecruitmentManagement('team-alpha').data
  assert.equal(captainView.effective.teamName, 'Team Alpha')
  assert.equal(captainView.effective.capacity, 4)
  assert.equal(captainView.draft.teamName, 'Alpha Revised')
  assert.equal(captainView.publication, 'Delisted')
  assert.equal(state.moderateRecruitment('team-alpha', 'Approve').code, 'ADMIN_REQUIRED')
  select(state, 'admin-reviewer')
  assert.equal(state.moderateRecruitment('team-alpha', 'Approve').ok, true)
  const publicAfter = state.getPublicRecruitment('team-alpha').data
  assert.equal(publicAfter.name, 'Alpha Revised')
  assert.equal(publicAfter.capacity, 3)
})

test('rejected recruitment revision requires captain resubmission before a later approval', () => {
  const state = new MockBusinessState()
  select(state, 'captain-alpha')
  assert.equal(state.submitRecruitmentRevision('team-alpha', { teamName: 'Rejected Alpha', summary: 'First proposed revision.', capacity: 4, requiredSkills: ['Python'] }).ok, true)
  select(state, 'admin-reviewer')
  const rejected = state.moderateRecruitment('team-alpha', 'Reject')
  assert.equal(rejected.ok, true)
  assert.equal(rejected.data.publication, 'Rejected')
  assert.equal(rejected.data.draft.teamName, 'Rejected Alpha')
  assert.equal(rejected.data.reviewHistory.length, 1)
  assert.equal(rejected.data.reviewHistory[0].decision, 'Rejected')
  assert.equal(state.getPublicRecruitment('team-alpha').code, 'PUBLIC_RECRUITMENT_NOT_FOUND')
  assert.equal(state.moderateRecruitment('team-alpha', 'Approve').code, 'NO_REVIEWABLE_DRAFT')

  select(state, 'captain-alpha')
  const resubmitted = state.submitRecruitmentRevision('team-alpha', { teamName: 'Resubmitted Alpha', summary: 'Corrected proposed revision.', capacity: 4, requiredSkills: ['Python', 'Research'] })
  assert.equal(resubmitted.ok, true)
  assert.equal(resubmitted.data.publication, 'Delisted')
  assert.equal(resubmitted.data.reviewHistory.length, 1)
  assert.notEqual(resubmitted.data.draftRevisionId, rejected.data.draftRevisionId)
  assert.equal(state.moderateRecruitment('team-alpha', 'Approve').code, 'ADMIN_REQUIRED')
  select(state, 'admin-reviewer')
  const approved = state.moderateRecruitment('team-alpha', 'Approve')
  assert.equal(approved.ok, true)
  assert.equal(approved.data.effective.teamName, 'Resubmitted Alpha')
  assert.equal(approved.data.reviewHistory.length, 2)
  assert.deepEqual(approved.data.reviewHistory.map((item) => item.decision), ['Rejected', 'Approved'])
})

test('moderation approval revalidates dissolution, deadline and changed capacity conditions', () => {
  const dissolved = new MockBusinessState()
  select(dissolved, 'captain-alpha')
  assert.equal(dissolved.submitRecruitmentRevision('team-alpha', { teamName: 'Dissolved Draft', summary: 'Must never publish.', capacity: 4, requiredSkills: ['Python'] }).ok, true)
  assert.equal(dissolved.dissolveTeam('team-alpha').ok, true)
  select(dissolved, 'admin-reviewer')
  assert.equal(dissolved.moderateRecruitment('team-alpha', 'Approve').code, 'TEAM_DISSOLVED')
  assert.equal(dissolved.getPublicRecruitment('team-alpha').code, 'PUBLIC_RECRUITMENT_NOT_FOUND')

  const expired = new MockBusinessState()
  select(expired, 'captain-alpha')
  assert.equal(expired.submitRecruitmentRevision('team-alpha', { teamName: 'Expired Draft', summary: 'Deadline changes before review.', capacity: 4, requiredSkills: ['Python'] }).ok, true)
  expired.applyNamedScenario('deadline-expired')
  select(expired, 'admin-reviewer')
  assert.equal(expired.moderateRecruitment('team-alpha', 'Approve').code, 'DEADLINE_PASSED')
  assert.equal(expired.getPublicRecruitment('team-alpha').code, 'PUBLIC_RECRUITMENT_NOT_FOUND')

  const capacity = new MockBusinessState()
  select(capacity, 'captain-alpha')
  assert.equal(capacity.submitRecruitmentRevision('team-alpha', { teamName: 'Capacity Draft', summary: 'Capacity becomes stale.', capacity: 2, requiredSkills: ['Python'] }).ok, true)
  assert.equal(capacity.approve('application-maya-alpha').ok, true)
  select(capacity, 'admin-reviewer')
  assert.equal(capacity.moderateRecruitment('team-alpha', 'Approve').code, 'CAPACITY_BELOW_MEMBERS')
  assert.equal(capacity.getPublicRecruitment('team-alpha').code, 'PUBLIC_RECRUITMENT_NOT_FOUND')
})

test('captain role is scoped per competition rather than blocking all student participation', () => {
  const unmatchedSkills = new MockBusinessState()
  select(unmatchedSkills, 'former-captain-alpha')
  const unmatchedApplication = unmatchedSkills.apply('team-beta')
  assert.equal(unmatchedApplication.ok, true)
  assert.equal(unmatchedApplication.data.status, 'Pending')

  const applicationState = new MockBusinessState()
  applicationState.applyNamedScenario('cross-competition-open')
  select(applicationState, 'captain-alpha')
  assert.equal(applicationState.apply('team-beta').code, 'MEMBERSHIP_EXISTS')
  const crossCompetitionApplication = applicationState.apply('team-archive')
  assert.equal(crossCompetitionApplication.ok, true)
  assert.equal(crossCompetitionApplication.data.competitionId, 'competition-demo-2')

  const creationState = new MockBusinessState()
  creationState.applyNamedScenario('cross-competition-open')
  select(creationState, 'captain-alpha')
  assert.equal(creationState.createTeam({ competitionId: 'competition-demo-1', name: 'Duplicate Scope', summary: 'Must remain blocked in the current competition.', capacity: 4, requiredSkills: ['Python'], submitRecruitment: false }).code, 'MEMBERSHIP_EXISTS')
  const crossCompetitionTeam = creationState.createTeam({ competitionId: 'competition-demo-2', name: 'Independent Scope', summary: 'Allowed in an independent competition.', capacity: 3, requiredSkills: ['Python'], submitRecruitment: false })
  assert.equal(crossCompetitionTeam.ok, true)
  assert.equal(crossCompetitionTeam.data.competitionId, 'competition-demo-2')
  assert.equal(crossCompetitionTeam.data.membershipRole, 'Captain')
  assert.equal(creationState.getRecruitmentManagement(crossCompetitionTeam.data.id).ok, true)
})

test('manual closure still allows approval of an existing eligible Pending application', () => {
  const state = new MockBusinessState()
  select(state, 'captain-alpha')
  assert.equal(state.setRecruitmentSwitch('team-alpha', 'Closed').ok, true)
  assert.equal(state.approve('application-maya-alpha').ok, true)
  assert.equal(state.getPublicRecruitment('team-alpha').data.availability, 'ManuallyClosed')
})

test('member leave and captain removal end access and reduce derived member count without reopening', () => {
  const leave = new MockBusinessState()
  select(leave, 'alpha-successor')
  assert.equal(leave.getTeamOperations('team-alpha').data.members.length, 2)
  assert.equal(leave.leaveTeam('team-alpha').ok, true)
  assert.equal(leave.getTeamOperations('team-alpha').code, 'MEMBERSHIP_REQUIRED')
  assert.equal(leave.getPublicRecruitment('team-alpha').data.memberCount, 1)

  const removal = new MockBusinessState()
  select(removal, 'captain-alpha')
  assert.equal(removal.setRecruitmentSwitch('team-alpha', 'Closed').ok, true)
  assert.equal(removal.removeMember('team-alpha', 'membership-alpha-member').ok, true)
  assert.equal(removal.getPublicRecruitment('team-alpha').data.memberCount, 1)
  assert.equal(removal.getPublicRecruitment('team-alpha').data.recruitmentSwitch, 'Closed')
  select(removal, 'alpha-successor')
  assert.equal(removal.getTeamOperations('team-alpha').code, 'MEMBERSHIP_REQUIRED')
})

test('captain cannot leave and transfer changes both roles and permissions immediately', () => {
  const state = new MockBusinessState()
  select(state, 'captain-alpha')
  assert.equal(state.leaveTeam('team-alpha').code, 'CAPTAIN_CANNOT_LEAVE')
  assert.equal(state.transferCaptain('team-alpha', 'membership-alpha-member').ok, true)
  assert.equal(state.getRecruitmentManagement('team-alpha').code, 'CAPTAIN_REQUIRED')
  assert.equal(state.getActiveMemberContacts('team-alpha').code, 'CAPTAIN_REQUIRED')
  select(state, 'alpha-successor')
  assert.equal(state.getRecruitmentManagement('team-alpha').ok, true)
  assert.equal(state.getActiveMemberContacts('team-alpha').ok, true)
})

test('dissolution invalidates Pending while retaining application and membership history', () => {
  const state = new MockBusinessState()
  select(state, 'captain-alpha')
  assert.equal(state.dissolveTeam('team-alpha').ok, true)
  assert.equal(state.getPublicRecruitment('team-alpha').code, 'PUBLIC_RECRUITMENT_NOT_FOUND')
  assert.equal(state.listCaptainQueue().code, 'CAPTAIN_REQUIRED')
  select(state, 'student-alex')
  const applications = state.listApplicationHistory().data
  assert.equal(applications.find((item) => item.id === 'application-alex-alpha').status, 'Invalidated')
  select(state, 'captain-alpha')
  const teams = state.listMyTeams().data
  assert.equal(teams.current.length, 0)
  assert.equal(teams.history.some((item) => item.id === 'team-alpha' && item.lifecycle === 'Dissolved'), true)
})

test('team member and contact responses stay separated by current captain authorization', () => {
  const state = new MockBusinessState()
  select(state, 'alpha-successor')
  const operations = state.getTeamOperations('team-alpha')
  assert.equal(operations.ok, true)
  assert.equal('contacts' in operations.data, false)
  assert.deepEqual(Object.keys(operations.data.members[0]).sort(), ['membershipId', 'role', 'status', 'username'].sort())
  assert.equal(state.getActiveMemberContacts('team-alpha').code, 'CAPTAIN_REQUIRED')
  select(state, 'captain-alpha')
  const contacts = state.getActiveMemberContacts('team-alpha')
  assert.equal(contacts.ok, true)
  assert.deepEqual(Object.keys(contacts.data[0]).sort(), ['memberName', 'membershipId', 'qqId', 'wechatId'].sort())
})
