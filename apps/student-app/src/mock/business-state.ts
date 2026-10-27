export type MockApplicationStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Withdrawn'
  | 'Invalidated'

export type MockActorRole =
  | 'Visitor'
  | 'Student'
  | 'CurrentCaptain'
  | 'FormerCaptain'
  | 'Admin'

export interface MockActorRecord {
  id: string
  label: string
  role: MockActorRole
  studentId?: string
  captainTeamId?: string
  skillTags?: string[]
}

interface MockApplicationRecord {
  id: string
  competitionId: string
  competitionTitle: string
  teamId: string
  teamName: string
  studentId: string
  status: MockApplicationStatus
  submittedDate: string
  updatedDate: string
  reason?: string
}

interface MockTeamRecord {
  id: string
  competitionId: string
  name: string
  captainActorId: string
  memberCount: number
  capacity: number
  lifecycle: 'Active' | 'Dissolved'
  publication: 'Published' | 'Delisted'
  recruitmentSwitch: 'Open' | 'Closed'
  requiredSkills: string[]
}

interface MockMembershipRecord {
  id: string
  competitionId: string
  teamId: string
  studentId: string
  status: 'Active' | 'Ended'
  role: 'Captain' | 'Member'
}

interface MockCompetitionRecord {
  id: string
  title: string
  deadlineStatus: 'BeforeDeadline' | 'AfterDeadline'
}

interface ApplicantProfileSource {
  studentId: string
  name: string
  college: string
  sex: string
  skillTags: string[]
  briefCv: string
  email: string
  wechatId: string
}

export interface MockResult<T = undefined> {
  ok: boolean
  code: string
  message: string
  data?: T
}

const actors: MockActorRecord[] = [
  { id: 'visitor', label: 'Visitor', role: 'Visitor' },
  { id: 'student-alex', label: 'Student Alex', role: 'Student', studentId: 'student-alex', skillTags: ['Python', 'Java'] },
  { id: 'captain-alpha', label: 'Team Alpha captain', role: 'CurrentCaptain', studentId: 'student-captain-alpha', captainTeamId: 'team-alpha' },
  { id: 'captain-delta', label: 'Team Delta captain', role: 'CurrentCaptain', studentId: 'student-captain-delta', captainTeamId: 'team-delta' },
  { id: 'alpha-successor', label: 'Alpha successor', role: 'Student', studentId: 'student-alpha-successor' },
  { id: 'former-captain-alpha', label: 'Former Alpha captain', role: 'FormerCaptain', studentId: 'student-former-alpha' },
  { id: 'admin-reviewer', label: 'Admin reviewer', role: 'Admin' },
]

const profiles: ApplicantProfileSource[] = [
  { studentId: 'student-alex', name: 'Alex Lin', college: 'College of Computing', sex: 'Male', skillTags: ['Python', 'Java'], briefCv: 'Built two small campus service prototypes.', email: 'alex@example.invalid', wechatId: 'private-alex' },
  { studentId: 'student-maya', name: 'Maya Chen', college: 'College of Design', sex: 'Female', skillTags: ['Research', 'Figma'], briefCv: 'Enjoys accessibility research and concise product experiments.', email: 'maya@example.invalid', wechatId: 'private-maya' },
  { studentId: 'student-noah', name: 'Noah Wu', college: 'College of Business', sex: 'Male', skillTags: ['Marketing'], briefCv: 'Interested in user interviews and presentation strategy.', email: 'noah@example.invalid', wechatId: 'private-noah' },
]

function initialTeams(): MockTeamRecord[] {
  return [
    { id: 'team-alpha', competitionId: 'competition-demo-1', name: 'Team Alpha', captainActorId: 'captain-alpha', memberCount: 2, capacity: 4, lifecycle: 'Active', publication: 'Published', recruitmentSwitch: 'Open', requiredSkills: ['Python', 'Java'] },
    { id: 'team-beta', competitionId: 'competition-demo-1', name: 'Team Beta', captainActorId: 'captain-beta', memberCount: 3, capacity: 4, lifecycle: 'Active', publication: 'Published', recruitmentSwitch: 'Open', requiredSkills: ['CAD'] },
    { id: 'team-gamma', competitionId: 'competition-demo-1', name: 'Team Gamma', captainActorId: 'captain-gamma', memberCount: 4, capacity: 4, lifecycle: 'Active', publication: 'Published', recruitmentSwitch: 'Open', requiredSkills: ['Research', 'Vue'] },
    { id: 'team-epsilon', competitionId: 'competition-demo-1', name: 'Team Epsilon', captainActorId: 'captain-epsilon', memberCount: 2, capacity: 4, lifecycle: 'Active', publication: 'Published', recruitmentSwitch: 'Closed', requiredSkills: ['Product Design'] },
    { id: 'team-delta', competitionId: 'competition-demo-1', name: 'Team Delta', captainActorId: 'captain-delta', memberCount: 2, capacity: 4, lifecycle: 'Active', publication: 'Delisted', recruitmentSwitch: 'Open', requiredSkills: ['Python'] },
    { id: 'team-archive', competitionId: 'competition-demo-2', name: 'Archive Team', captainActorId: 'captain-archive', memberCount: 2, capacity: 3, lifecycle: 'Active', publication: 'Published', recruitmentSwitch: 'Open', requiredSkills: ['Python', 'Mathematical Modeling'] },
  ]
}

function initialApplications(): MockApplicationRecord[] {
  return [
    { id: 'application-history-rejected', competitionId: 'competition-demo-1', competitionTitle: '2026 University Innovation Challenge', teamId: 'team-beta', teamName: 'Team Beta', studentId: 'student-alex', status: 'Rejected', submittedDate: '2026-10-02', updatedDate: '2026-10-04', reason: 'Captain selected another applicant.' },
    { id: 'application-history-withdrawn', competitionId: 'competition-demo-1', competitionTitle: '2026 University Innovation Challenge', teamId: 'team-alpha', teamName: 'Team Alpha', studentId: 'student-alex', status: 'Withdrawn', submittedDate: '2026-10-05', updatedDate: '2026-10-06', reason: 'Withdrawn by applicant.' },
    { id: 'application-history-invalidated', competitionId: 'competition-demo-1', competitionTitle: '2026 University Innovation Challenge', teamId: 'team-epsilon', teamName: 'Team Epsilon', studentId: 'student-alex', status: 'Invalidated', submittedDate: '2026-10-08', updatedDate: '2026-10-09', reason: 'Team reached capacity. This record does not become Pending again automatically.' },
    { id: 'application-alex-alpha', competitionId: 'competition-demo-1', competitionTitle: '2026 University Innovation Challenge', teamId: 'team-alpha', teamName: 'Team Alpha', studentId: 'student-alex', status: 'Pending', submittedDate: '2026-10-20', updatedDate: '2026-10-20' },
    { id: 'application-alex-beta', competitionId: 'competition-demo-1', competitionTitle: '2026 University Innovation Challenge', teamId: 'team-beta', teamName: 'Team Beta', studentId: 'student-alex', status: 'Pending', submittedDate: '2026-10-21', updatedDate: '2026-10-21' },
    { id: 'application-history-approved', competitionId: 'competition-demo-2', competitionTitle: 'Campus Mathematical Modeling Contest', teamId: 'team-archive', teamName: 'Archive Team', studentId: 'student-alex', status: 'Approved', submittedDate: '2026-08-10', updatedDate: '2026-08-12', reason: 'Membership later ended; this approval is historical.' },
    { id: 'application-maya-alpha', competitionId: 'competition-demo-1', competitionTitle: '2026 University Innovation Challenge', teamId: 'team-alpha', teamName: 'Team Alpha', studentId: 'student-maya', status: 'Pending', submittedDate: '2026-10-22', updatedDate: '2026-10-22' },
    { id: 'application-noah-alpha', competitionId: 'competition-demo-1', competitionTitle: '2026 University Innovation Challenge', teamId: 'team-alpha', teamName: 'Team Alpha', studentId: 'student-noah', status: 'Pending', submittedDate: '2026-10-23', updatedDate: '2026-10-23' },
  ]
}

export class MockBusinessState {
  private selectedActorId = 'visitor'
  private applications = initialApplications()
  private teams = initialTeams()
  private memberships: MockMembershipRecord[] = [
    { id: 'membership-history-alex', competitionId: 'competition-demo-2', teamId: 'team-archive', studentId: 'student-alex', status: 'Ended', role: 'Member' },
  ]
  private competitions: MockCompetitionRecord[] = [
    { id: 'competition-demo-1', title: '2026 University Innovation Challenge', deadlineStatus: 'BeforeDeadline' },
    { id: 'competition-demo-2', title: 'Campus Mathematical Modeling Contest', deadlineStatus: 'AfterDeadline' },
  ]
  private sequence = 100

  reset(): void {
    this.selectedActorId = 'visitor'
    this.applications = initialApplications()
    this.teams = initialTeams()
    this.memberships = [{ id: 'membership-history-alex', competitionId: 'competition-demo-2', teamId: 'team-archive', studentId: 'student-alex', status: 'Ended', role: 'Member' }]
    this.competitions = [
      { id: 'competition-demo-1', title: '2026 University Innovation Challenge', deadlineStatus: 'BeforeDeadline' },
      { id: 'competition-demo-2', title: 'Campus Mathematical Modeling Contest', deadlineStatus: 'AfterDeadline' },
    ]
    this.sequence = 100
  }

  listActors(): MockActorRecord[] { return actors.map((actor) => ({ ...actor, skillTags: actor.skillTags ? [...actor.skillTags] : undefined })) }
  getActor(): MockActorRecord {
    const base = actors.find((actor) => actor.id === this.selectedActorId)!
    const captainedTeam = this.teams.find((team) => team.captainActorId === base.id)
    if (captainedTeam) return { ...base, role: 'CurrentCaptain', captainTeamId: captainedTeam.id }
    if (base.role === 'CurrentCaptain') return { ...base, role: 'FormerCaptain', captainTeamId: undefined }
    return { ...base }
  }
  selectActor(actorId: string): MockResult<MockActorRecord> {
    const actor = actors.find((item) => item.id === actorId)
    if (!actor) return failure('ACTOR_NOT_FOUND', 'Demo persona not found.')
    this.selectedActorId = actorId
    return success('ACTOR_SELECTED', `Prototype persona selected: ${actor.label}.`, { ...actor })
  }

  canReviewRecruitment(teamId: string): boolean {
    const actor = this.getActor()
    return actor.role === 'Admin' || (actor.role === 'CurrentCaptain' && actor.captainTeamId === teamId)
  }

  getTeamSnapshot(teamId: string): MockTeamRecord | undefined {
    const team = this.teams.find((item) => item.id === teamId)
    return team ? { ...team, requiredSkills: [...team.requiredSkills] } : undefined
  }

  listApplicationHistory(): MockResult<Array<Record<string, unknown>>> {
    const actor = this.getActor()
    if (actor.role !== 'Student' || !actor.studentId) return failure('STUDENT_REQUIRED', 'Select the Student Alex persona to view owner history.')
    const data = this.applications
      .filter((item) => item.studentId === actor.studentId)
      .map((item) => ({
        id: item.id,
        competitionId: item.competitionId,
        competitionTitle: item.competitionTitle,
        teamId: item.teamId,
        teamName: item.teamName,
        submittedDate: item.submittedDate,
        updatedDate: item.updatedDate,
        status: item.status,
        reason: item.reason,
        isCurrentMembership: this.hasActiveMembership(item.studentId, item.competitionId, item.teamId),
        canWithdraw: item.status === 'Pending',
        canReapply: ['Rejected', 'Withdrawn', 'Invalidated'].includes(item.status),
      }))
      .reverse()
    return success('APPLICATION_HISTORY', 'Owner application history loaded.', data)
  }

  apply(teamId: string): MockResult<Record<string, unknown>> {
    const actor = this.getActor()
    if (actor.role !== 'Student' || !actor.studentId) return failure('STUDENT_REQUIRED', 'Select an eligible student persona before applying.')
    const guard = this.checkFreshApplication(actor.studentId, teamId)
    if (!guard.ok) return failure(guard.code, guard.message)
    const team = this.teams.find((item) => item.id === teamId)!
    const competition = this.competitions.find((item) => item.id === team.competitionId)!
    this.sequence += 1
    const record: MockApplicationRecord = {
      id: `application-demo-${this.sequence}`,
      competitionId: team.competitionId,
      competitionTitle: competition.title,
      teamId: team.id,
      teamName: team.name,
      studentId: actor.studentId,
      status: 'Pending',
      submittedDate: '2026-10-27',
      updatedDate: '2026-10-27',
    }
    this.applications.push(record)
    return success('APPLICATION_CREATED', 'Mock application created with Pending status.', { ...record })
  }

  withdraw(applicationId: string): MockResult {
    const actor = this.getActor()
    const item = this.applications.find((record) => record.id === applicationId)
    if (!item || !actor.studentId || item.studentId !== actor.studentId) return failure('NOT_OWNER', 'This application is not available to the selected student.')
    if (item.status !== 'Pending') return failure('NOT_PENDING', 'Only a Pending application can be withdrawn.')
    item.status = 'Withdrawn'
    item.updatedDate = '2026-10-27'
    item.reason = 'Withdrawn by applicant.'
    return success('APPLICATION_WITHDRAWN', 'Application withdrawn. The history record was preserved.')
  }

  reapply(applicationId: string): MockResult<Record<string, unknown>> {
    const actor = this.getActor()
    const previous = this.applications.find((record) => record.id === applicationId)
    if (!previous || !actor.studentId || previous.studentId !== actor.studentId) return failure('NOT_OWNER', 'This application is not available to the selected student.')
    if (!['Rejected', 'Withdrawn', 'Invalidated'].includes(previous.status)) return failure('REAPPLY_NOT_ALLOWED', 'Only Rejected, Withdrawn or Invalidated history can start a new application.')
    return this.apply(previous.teamId)
  }

  listCaptainQueue(): MockResult<Array<Record<string, unknown>>> {
    const actor = this.getActor()
    if (actor.role !== 'CurrentCaptain' || !actor.captainTeamId) return failure('CAPTAIN_REQUIRED', 'Only the current captain can review this team\'s Pending applications.')
    const team = this.teams.find((item) => item.id === actor.captainTeamId && item.captainActorId === actor.id)
    if (!team) return failure('CAPTAIN_SCOPE_CHANGED', 'Captain authorization is no longer current for this team.')
    const data = this.applications
      .filter((item) => item.teamId === team.id && item.status === 'Pending')
      .map((item) => {
        const profile = profiles.find((candidate) => candidate.studentId === item.studentId)!
        const matched = profile.skillTags.some((skill) => team.requiredSkills.includes(skill))
        return {
          id: item.id,
          competitionId: item.competitionId,
          teamId: item.teamId,
          teamName: item.teamName,
          submittedDate: item.submittedDate,
          matchStatus: matched ? 'Matched' : 'NotMatched',
          applicant: {
            name: profile.name,
            college: profile.college,
            sex: profile.sex,
            skillTags: [...profile.skillTags],
            briefCv: profile.briefCv,
          },
        }
      })
    return success('CAPTAIN_QUEUE', 'Sanitized Pending queue loaded.', data)
  }

  approve(applicationId: string): MockResult {
    const auth = this.authorizeCaptainApplication(applicationId)
    if (!auth.ok || !auth.application || !auth.team) return failure(auth.code, auth.message)
    const item = auth.application
    const team = auth.team
    const competition = this.competitions.find((entry) => entry.id === item.competitionId)!
    if (item.status !== 'Pending') return failure('APPLICATION_NOT_PENDING', 'Cannot process this application: it is no longer Pending.')
    if (team.lifecycle !== 'Active') return failure('TEAM_DISSOLVED', 'Cannot process this application: the team is dissolved.')
    if (competition.deadlineStatus === 'AfterDeadline') return failure('DEADLINE_PASSED', 'Cannot process this application: registration has closed.')
    if (this.hasActiveMembership(item.studentId, item.competitionId)) return failure('MEMBERSHIP_EXISTS', 'Cannot process this application: the applicant already has a current team.')
    if (team.memberCount >= team.capacity) return failure('TEAM_FULL', 'This team is full.')

    item.status = 'Approved'
    item.updatedDate = '2026-10-27'
    item.reason = 'Approved by the current captain.'
    team.memberCount += 1
    this.sequence += 1
    this.memberships.push({ id: `membership-demo-${this.sequence}`, competitionId: item.competitionId, teamId: item.teamId, studentId: item.studentId, status: 'Active', role: 'Member' })
    this.invalidateWhere(
      (record) => record.studentId === item.studentId && record.competitionId === item.competitionId && record.id !== item.id,
      'Applicant joined another team in this competition.',
    )
    if (team.memberCount >= team.capacity) {
      this.invalidateWhere((record) => record.teamId === team.id && record.id !== item.id, 'Team reached capacity.')
    }
    return success('APPLICATION_APPROVED', 'Application approved; membership created in Mock state.')
  }

  reject(applicationId: string): MockResult {
    const auth = this.authorizeCaptainApplication(applicationId)
    if (!auth.ok || !auth.application) return failure(auth.code, auth.message)
    if (auth.application.status !== 'Pending') return failure('APPLICATION_NOT_PENDING', 'Cannot process this application: it is no longer Pending.')
    auth.application.status = 'Rejected'
    auth.application.updatedDate = '2026-10-27'
    auth.application.reason = 'Rejected by the current captain.'
    return success('APPLICATION_REJECTED', 'Application rejected; history retained.')
  }

  applyNamedScenario(name: 'manual-closed' | 'revision-delisted' | 'full' | 'deadline-expired' | 'dissolved' | 'captain-transferred' | 'former-member'): MockResult {
    if (name === 'manual-closed') this.teams.find((team) => team.id === 'team-alpha')!.recruitmentSwitch = 'Closed'
    if (name === 'revision-delisted') this.teams.find((team) => team.id === 'team-alpha')!.publication = 'Delisted'
    if (name === 'full') {
      const team = this.teams.find((item) => item.id === 'team-alpha')!
      team.memberCount = team.capacity
      this.invalidateWhere((record) => record.teamId === team.id, 'Team reached capacity.')
    }
    if (name === 'deadline-expired') {
      this.competitions.find((item) => item.id === 'competition-demo-1')!.deadlineStatus = 'AfterDeadline'
      this.invalidateWhere((record) => record.competitionId === 'competition-demo-1', 'Competition registration deadline passed.')
    }
    if (name === 'dissolved') {
      this.teams.find((team) => team.id === 'team-alpha')!.lifecycle = 'Dissolved'
      this.invalidateWhere((record) => record.teamId === 'team-alpha', 'Team was dissolved.')
    }
    if (name === 'captain-transferred') {
      const team = this.teams.find((item) => item.id === 'team-alpha')!
      team.captainActorId = 'alpha-successor'
    }
    if (name === 'former-member') {
      const membership = this.memberships.find((item) => item.studentId === 'student-alex' && item.competitionId === 'competition-demo-1')
      if (membership) membership.status = 'Ended'
      else this.memberships.push({ id: 'membership-ended-alex', competitionId: 'competition-demo-1', teamId: 'team-alpha', studentId: 'student-alex', status: 'Ended', role: 'Member' })
    }
    return success('SCENARIO_APPLIED', `Named Mock scenario applied: ${name}.`)
  }

  private checkFreshApplication(studentId: string, teamId: string): MockResult {
    const team = this.teams.find((item) => item.id === teamId)
    if (!team) return failure('TEAM_NOT_FOUND', 'Recruitment not found.')
    const competition = this.competitions.find((item) => item.id === team.competitionId)!
    if (this.hasActiveMembership(studentId, team.competitionId)) return failure('MEMBERSHIP_EXISTS', 'You already have a current team in this competition.')
    if (this.applications.some((item) => item.studentId === studentId && item.teamId === teamId && item.status === 'Pending')) return failure('PENDING_EXISTS', 'A Pending application already exists for this team.')
    if (team.lifecycle !== 'Active') return failure('TEAM_DISSOLVED', 'This team is dissolved.')
    if (competition.deadlineStatus === 'AfterDeadline') return failure('DEADLINE_PASSED', 'Registration closed. New applications are unavailable.')
    if (team.publication !== 'Published') return failure('RECRUITMENT_DELISTED', 'Recruitment is delisted under review.')
    if (team.recruitmentSwitch !== 'Open') return failure('RECRUITMENT_CLOSED', 'Recruitment is manually closed.')
    if (team.memberCount >= team.capacity) return failure('TEAM_FULL', 'This team is full.')
    return success('ELIGIBLE', 'Eligible to apply.')
  }

  private authorizeCaptainApplication(applicationId: string): { ok: boolean; code: string; message: string; application?: MockApplicationRecord; team?: MockTeamRecord } {
    const actor = this.getActor()
    if (actor.role !== 'CurrentCaptain' || !actor.captainTeamId) return { ok: false, code: 'CAPTAIN_REQUIRED', message: 'Only the current captain can process this application.' }
    const item = this.applications.find((record) => record.id === applicationId)
    if (!item || item.teamId !== actor.captainTeamId) return { ok: false, code: 'OUT_OF_SCOPE', message: 'This application is outside the captain\'s current team.' }
    const team = this.teams.find((record) => record.id === item.teamId)
    if (!team || team.captainActorId !== actor.id) return { ok: false, code: 'CAPTAIN_SCOPE_CHANGED', message: 'Captain authorization is no longer current for this team.' }
    return { ok: true, code: 'AUTHORIZED', message: 'Authorized.', application: item, team }
  }

  private hasActiveMembership(studentId: string, competitionId: string, teamId?: string): boolean {
    return this.memberships.some((item) => item.studentId === studentId && item.competitionId === competitionId && item.status === 'Active' && (!teamId || item.teamId === teamId))
  }

  private invalidateWhere(predicate: (item: MockApplicationRecord) => boolean, reason: string): void {
    this.applications.forEach((item) => {
      if (item.status === 'Pending' && predicate(item)) {
        item.status = 'Invalidated'
        item.updatedDate = '2026-10-27'
        item.reason = reason
      }
    })
  }
}

function success<T = undefined>(code: string, message: string, data?: T): MockResult<T> {
  return { ok: true, code, message, data }
}

function failure<T = undefined>(code: string, message: string): MockResult<T> {
  return { ok: false, code, message }
}

export const mockBusinessState = new MockBusinessState()
