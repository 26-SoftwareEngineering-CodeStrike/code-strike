import type { ApplicationStatus, PrototypeActorRole, RecruitmentPublicationStatus } from '@codestrike/contracts'

export type MockApplicationStatus = ApplicationStatus
export type MockActorRole = PrototypeActorRole
export type MockPublication = RecruitmentPublicationStatus

export interface MockActorRecord {
  id: string
  label: string
  role: MockActorRole
  studentId?: string
  captainTeamId?: string
  skillTags?: string[]
}

export interface MockResult<T = undefined> {
  ok: boolean
  code: string
  message: string
  data?: T
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

interface RecruitmentSettingsRecord {
  teamName: string
  summary: string
  capacity: number
  requiredSkills: string[]
}

interface RecruitmentReviewRecord {
  revisionId: string
  decision: 'Approved' | 'Rejected'
  settings: RecruitmentSettingsRecord
}

interface MockTeamRecord {
  id: string
  competitionId: string
  captainActorId: string
  lifecycle: 'Active' | 'Dissolved'
  publication: MockPublication
  recruitmentSwitch: 'Open' | 'Closed'
  effective: RecruitmentSettingsRecord
  draft?: RecruitmentSettingsRecord
  draftRevisionId?: string
  reviewHistory: RecruitmentReviewRecord[]
  hasApprovedRecruitment: boolean
  demoMatchStatus: 'Matched' | 'NotMatched'
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
  deadline: string
  deadlineStatus: 'BeforeDeadline' | 'AfterDeadline'
  maximumTeamSize: number
}

interface ApplicantProfileSource {
  studentId: string
  actorId?: string
  username: string
  name: string
  college: string
  sex: string
  skillTags: string[]
  briefCv: string
  profileComplete: boolean
  eligibleCompetitionIds: string[]
  email: string
  wechatId?: string
  qqId?: string
}

interface CreateTeamCommand {
  competitionId: string
  name: string
  summary: string
  capacity: number
  requiredSkills: string[]
  submitRecruitment: boolean
}

const actorSeeds: MockActorRecord[] = [
  { id: 'visitor', label: 'Visitor', role: 'Visitor' },
  { id: 'student-alex', label: 'Student Alex', role: 'Student', studentId: 'student-alex', skillTags: ['Python', 'Java'] },
  { id: 'student-incomplete', label: 'Incomplete student', role: 'Student', studentId: 'student-incomplete', skillTags: ['Vue'] },
  { id: 'captain-alpha', label: 'Team Alpha captain', role: 'CurrentCaptain', studentId: 'student-captain-alpha', captainTeamId: 'team-alpha' },
  { id: 'captain-delta', label: 'Team Delta captain', role: 'CurrentCaptain', studentId: 'student-captain-delta', captainTeamId: 'team-delta' },
  { id: 'alpha-successor', label: 'Team Alpha member', role: 'Student', studentId: 'student-alpha-successor' },
  { id: 'delta-member', label: 'Team Delta member', role: 'Student', studentId: 'student-delta-member' },
  { id: 'former-captain-alpha', label: 'Former captain', role: 'FormerCaptain', studentId: 'student-former-alpha' },
  { id: 'admin-reviewer', label: 'Admin reviewer', role: 'Admin' },
]

const profileSeeds: ApplicantProfileSource[] = [
  profile('student-alex', 'student-alex', 'alex_demo', 'Alex Lin', 'College of Computing', 'Male', ['Python', 'Java'], 'Built two small campus service prototypes.', true, ['competition-demo-1', 'competition-demo-2'], 'alex'),
  profile('student-incomplete', 'student-incomplete', 'profile_todo', 'Taylor Sun', 'College of Computing', 'Female', ['Vue'], 'Profile completion is intentionally unfinished.', false, ['competition-demo-1'], 'taylor'),
  profile('student-captain-alpha', 'captain-alpha', 'orbit_captain', 'Jordan Lee', 'College of Engineering', 'Female', ['Python', 'Java'], 'Captain of Team Alpha.', true, ['competition-demo-1', 'competition-demo-2'], 'jordan'),
  profile('student-alpha-successor', 'alpha-successor', 'nova_member', 'Nova Zhou', 'College of Design', 'Female', ['Product Design'], 'Active Team Alpha member.', true, ['competition-demo-1'], 'nova'),
  profile('student-captain-delta', 'captain-delta', 'delta_captain', 'Kai Xu', 'College of Computing', 'Male', ['Python'], 'Captain of Team Delta.', true, ['competition-demo-1'], 'kai'),
  profile('student-delta-member', 'delta-member', 'delta_member', 'Riley Gu', 'College of Science', 'Female', ['Data Visualization'], 'Active Team Delta member.', true, ['competition-demo-1'], 'riley'),
  profile('student-former-alpha', 'former-captain-alpha', 'former_lead', 'Morgan He', 'College of Engineering', 'Male', ['Java'], 'Former team member.', true, ['competition-demo-1'], 'morgan'),
  profile('student-maya', undefined, 'maya_demo', 'Maya Chen', 'College of Design', 'Female', ['Research', 'Figma'], 'Enjoys accessibility research and concise product experiments.', true, ['competition-demo-1'], 'maya'),
  profile('student-noah', undefined, 'noah_demo', 'Noah Wu', 'College of Business', 'Male', ['Marketing'], 'Interested in user interviews and presentation strategy.', true, ['competition-demo-1'], 'noah'),
]

function profile(studentId: string, actorId: string | undefined, username: string, name: string, college: string, sex: string, skillTags: string[], briefCv: string, profileComplete: boolean, eligibleCompetitionIds: string[], contactSeed: string): ApplicantProfileSource {
  return { studentId, actorId, username, name, college, sex, skillTags, briefCv, profileComplete, eligibleCompetitionIds, email: `${contactSeed}@example.invalid`, wechatId: `mock_${contactSeed}`, qqId: `9000${contactSeed.length}` }
}

function settings(teamName: string, summary: string, capacity: number, requiredSkills: string[]): RecruitmentSettingsRecord {
  return { teamName, summary, capacity, requiredSkills }
}

function initialTeams(): MockTeamRecord[] {
  return [
    team('team-alpha', 'competition-demo-1', 'captain-alpha', 'Published', 'Open', settings('Team Alpha', 'Building an accessible campus navigation concept with a lightweight data prototype.', 4, ['Python', 'Java']), true, 'Matched'),
    team('team-beta', 'competition-demo-1', 'captain-beta', 'Published', 'Open', settings('Team Beta', 'Exploring a modular product concept and looking for a teammate comfortable with CAD.', 4, ['CAD']), true, 'NotMatched'),
    team('team-gamma', 'competition-demo-1', 'captain-gamma', 'Published', 'Closed', settings('Team Gamma', 'A complete four-person team researching low-energy campus services.', 4, ['Research', 'Vue']), true, 'Matched'),
    team('team-epsilon', 'competition-demo-1', 'captain-epsilon', 'Published', 'Closed', settings('Team Epsilon', 'Recruitment is paused manually while the captain reviews existing applications.', 4, ['Product Design']), true, 'NotMatched'),
    { ...team('team-delta', 'competition-demo-1', 'captain-delta', 'Delisted', 'Open', settings('Team Delta', 'Effective approved summary retained while a recruitment revision is reviewed.', 4, ['Python']), true, 'Matched'), draft: settings('Team Delta Studio', 'Draft revision adding a data visualization focus.', 4, ['Python', 'Data Visualization']), draftRevisionId: 'recruitment-revision-delta-1' },
    team('team-archive', 'competition-demo-2', 'captain-archive', 'Published', 'Open', settings('Archive Team', 'An existing team retained for community reference after registration closed.', 3, ['Python', 'Mathematical Modeling']), true, 'Matched'),
  ]
}

function team(id: string, competitionId: string, captainActorId: string, publication: MockPublication, recruitmentSwitch: 'Open' | 'Closed', effective: RecruitmentSettingsRecord, hasApprovedRecruitment: boolean, demoMatchStatus: 'Matched' | 'NotMatched'): MockTeamRecord {
  return { id, competitionId, captainActorId, lifecycle: 'Active', publication, recruitmentSwitch, effective, reviewHistory: [], hasApprovedRecruitment, demoMatchStatus }
}

function initialMemberships(): MockMembershipRecord[] {
  const rows: MockMembershipRecord[] = [
    membership('membership-alpha-captain', 'competition-demo-1', 'team-alpha', 'student-captain-alpha', 'Active', 'Captain'),
    membership('membership-alpha-member', 'competition-demo-1', 'team-alpha', 'student-alpha-successor', 'Active', 'Member'),
    membership('membership-delta-captain', 'competition-demo-1', 'team-delta', 'student-captain-delta', 'Active', 'Captain'),
    membership('membership-delta-member', 'competition-demo-1', 'team-delta', 'student-delta-member', 'Active', 'Member'),
    membership('membership-former-alpha', 'competition-demo-1', 'team-alpha', 'student-former-alpha', 'Ended', 'Captain'),
    membership('membership-history-alex', 'competition-demo-2', 'team-archive', 'student-alex', 'Ended', 'Member'),
  ]
  seedAnonymous(rows, 'team-beta', 'competition-demo-1', 3)
  seedAnonymous(rows, 'team-gamma', 'competition-demo-1', 4)
  seedAnonymous(rows, 'team-epsilon', 'competition-demo-1', 2)
  seedAnonymous(rows, 'team-archive', 'competition-demo-2', 2)
  return rows
}

function membership(id: string, competitionId: string, teamId: string, studentId: string, status: 'Active' | 'Ended', role: 'Captain' | 'Member'): MockMembershipRecord {
  return { id, competitionId, teamId, studentId, status, role }
}

function seedAnonymous(rows: MockMembershipRecord[], teamId: string, competitionId: string, count: number): void {
  for (let index = 0; index < count; index += 1) rows.push(membership(`membership-${teamId}-${index + 1}`, competitionId, teamId, `${teamId}-student-${index + 1}`, 'Active', index === 0 ? 'Captain' : 'Member'))
}

function initialApplications(): MockApplicationRecord[] {
  return [
    application('application-history-rejected', 'competition-demo-1', '2026 University Innovation Challenge', 'team-beta', 'Team Beta', 'student-alex', 'Rejected', '2026-10-02', '2026-10-04', 'Captain selected another applicant.'),
    application('application-history-withdrawn', 'competition-demo-1', '2026 University Innovation Challenge', 'team-alpha', 'Team Alpha', 'student-alex', 'Withdrawn', '2026-10-05', '2026-10-06', 'Withdrawn by applicant.'),
    application('application-history-invalidated', 'competition-demo-1', '2026 University Innovation Challenge', 'team-epsilon', 'Team Epsilon', 'student-alex', 'Invalidated', '2026-10-08', '2026-10-09', 'Team reached capacity. This record does not become Pending again automatically.'),
    application('application-alex-alpha', 'competition-demo-1', '2026 University Innovation Challenge', 'team-alpha', 'Team Alpha', 'student-alex', 'Pending', '2026-10-20', '2026-10-20'),
    application('application-alex-beta', 'competition-demo-1', '2026 University Innovation Challenge', 'team-beta', 'Team Beta', 'student-alex', 'Pending', '2026-10-21', '2026-10-21'),
    application('application-history-approved', 'competition-demo-2', 'Campus Mathematical Modeling Contest', 'team-archive', 'Archive Team', 'student-alex', 'Approved', '2026-08-10', '2026-08-12', 'Membership later ended; this approval is historical.'),
    application('application-maya-alpha', 'competition-demo-1', '2026 University Innovation Challenge', 'team-alpha', 'Team Alpha', 'student-maya', 'Pending', '2026-10-22', '2026-10-22'),
    application('application-noah-alpha', 'competition-demo-1', '2026 University Innovation Challenge', 'team-alpha', 'Team Alpha', 'student-noah', 'Pending', '2026-10-23', '2026-10-23'),
  ]
}

function application(id: string, competitionId: string, competitionTitle: string, teamId: string, teamName: string, studentId: string, status: MockApplicationStatus, submittedDate: string, updatedDate: string, reason?: string): MockApplicationRecord {
  return { id, competitionId, competitionTitle, teamId, teamName, studentId, status, submittedDate, updatedDate, reason }
}

export class MockBusinessState {
  private selectedActorId = 'visitor'
  private applications = initialApplications()
  private teams = initialTeams()
  private memberships = initialMemberships()
  private competitions: MockCompetitionRecord[] = [
    { id: 'competition-demo-1', title: '2026 University Innovation Challenge', deadline: '2026-12-15T16:00:00Z', deadlineStatus: 'BeforeDeadline', maximumTeamSize: 4 },
    { id: 'competition-demo-2', title: 'Campus Mathematical Modeling Contest', deadline: '2026-09-20T16:00:00Z', deadlineStatus: 'AfterDeadline', maximumTeamSize: 3 },
  ]
  private sequence = 100

  reset(): void {
    this.selectedActorId = 'visitor'
    this.applications = initialApplications()
    this.teams = initialTeams()
    this.memberships = initialMemberships()
    this.competitions = [
      { id: 'competition-demo-1', title: '2026 University Innovation Challenge', deadline: '2026-12-15T16:00:00Z', deadlineStatus: 'BeforeDeadline', maximumTeamSize: 4 },
      { id: 'competition-demo-2', title: 'Campus Mathematical Modeling Contest', deadline: '2026-09-20T16:00:00Z', deadlineStatus: 'AfterDeadline', maximumTeamSize: 3 },
    ]
    this.sequence = 100
  }

  listActors(): MockActorRecord[] { return actorSeeds.map((actor) => this.resolveActor(actor)) }
  getActor(): MockActorRecord { return this.resolveActor(actorSeeds.find((actor) => actor.id === this.selectedActorId)!) }
  selectActor(actorId: string): MockResult<MockActorRecord> {
    const actor = actorSeeds.find((item) => item.id === actorId)
    if (!actor) return failure('ACTOR_NOT_FOUND', 'Demo persona not found.')
    this.selectedActorId = actorId
    return success('ACTOR_SELECTED', `Prototype persona selected: ${actor.label}.`, this.resolveActor(actor))
  }

  listPublicRecruitments(competitionId: string): Array<Record<string, unknown>> {
    return this.teams.filter((team) => team.competitionId === competitionId && this.isPublic(team)).map((team) => this.publicRecruitment(team))
  }

  getPublicRecruitment(teamId: string): MockResult<Record<string, unknown>> {
    const team = this.teams.find((item) => item.id === teamId)
    if (!team || !this.isPublic(team)) return failure('PUBLIC_RECRUITMENT_NOT_FOUND', 'Recruitment not found in the public listing.')
    return success('PUBLIC_RECRUITMENT', 'Public recruitment loaded.', this.publicRecruitment(team))
  }

  getRecruitmentReview(teamId: string): MockResult<Record<string, unknown>> {
    const team = this.teams.find((item) => item.id === teamId)
    if (!team || !this.canReviewRecruitment(teamId)) return failure('REVIEW_DENIED', 'Design review denied for the selected prototype persona.')
    return success('RECRUITMENT_REVIEW', 'Isolated recruitment review loaded.', this.reviewRecruitment(team))
  }

  canReviewRecruitment(teamId: string): boolean {
    const actor = this.getActor()
    return actor.role === 'Admin' || this.authorizeCaptain(teamId).ok
  }

  listApplicationHistory(): MockResult<Array<Record<string, unknown>>> {
    const actor = this.getActor()
    if (!actor.studentId || actor.role === 'Visitor' || actor.role === 'Admin') return failure('STUDENT_REQUIRED', 'Select a student persona to view owner history.')
    const data = this.applications.filter((item) => item.studentId === actor.studentId).map((item) => ({
      id: item.id, competitionId: item.competitionId, competitionTitle: item.competitionTitle, teamId: item.teamId, teamName: item.teamName,
      submittedDate: item.submittedDate, updatedDate: item.updatedDate, status: item.status, reason: item.reason,
      isCurrentMembership: this.hasActiveMembership(item.studentId, item.competitionId, item.teamId),
      canWithdraw: item.status === 'Pending', canReapply: ['Rejected', 'Withdrawn', 'Invalidated'].includes(item.status),
    })).reverse()
    return success('APPLICATION_HISTORY', 'Owner application history loaded.', data)
  }

  apply(teamId: string): MockResult<Record<string, unknown>> {
    const actor = this.getActor()
    if (!this.isStudentActor(actor)) return failure('STUDENT_REQUIRED', 'Select an eligible student persona before applying.')
    const guard = this.checkFreshApplication(actor.studentId, teamId)
    if (!guard.ok) return failure(guard.code, guard.message)
    const team = this.teams.find((item) => item.id === teamId)!
    const competition = this.competition(team.competitionId)
    this.sequence += 1
    const record = application(`application-demo-${this.sequence}`, team.competitionId, competition.title, team.id, team.effective.teamName, actor.studentId, 'Pending', '2026-10-27', '2026-10-27')
    this.applications.push(record)
    return success('APPLICATION_CREATED', 'Mock application created with Pending status.', this.applicationResponse(record))
  }

  withdraw(applicationId: string): MockResult {
    const actor = this.getActor()
    const item = this.applications.find((record) => record.id === applicationId)
    if (!item || !actor.studentId || item.studentId !== actor.studentId) return failure('NOT_OWNER', 'This application is not available to the selected student.')
    if (item.status !== 'Pending') return failure('NOT_PENDING', 'Only a Pending application can be withdrawn.')
    item.status = 'Withdrawn'; item.updatedDate = '2026-10-27'; item.reason = 'Withdrawn by applicant.'
    return success('APPLICATION_WITHDRAWN', 'Application withdrawn. The history record was preserved.')
  }

  reapply(applicationId: string): MockResult<Record<string, unknown>> {
    const actor = this.getActor()
    const previous = this.applications.find((record) => record.id === applicationId)
    if (!previous || !actor.studentId || previous.studentId !== actor.studentId) return failure('NOT_OWNER', 'This application is not available to the selected student.')
    if (!['Rejected', 'Withdrawn', 'Invalidated'].includes(previous.status)) return failure('REAPPLY_NOT_ALLOWED', 'Only Rejected, Withdrawn or Invalidated history can start a new application.')
    return this.apply(previous.teamId)
  }

  listCaptainQueue(teamId?: string): MockResult<Array<Record<string, unknown>>> {
    const auth = this.authorizeCaptain(teamId)
    if (!auth.ok || !auth.team) return failure(auth.code, auth.message)
    const team = auth.team
    const data = this.applications.filter((item) => item.teamId === team.id && item.status === 'Pending').map((item) => {
      const candidate = this.profile(item.studentId)
      const matched = candidate.skillTags.some((skill) => team.effective.requiredSkills.includes(skill))
      return { id: item.id, competitionId: item.competitionId, teamId: item.teamId, teamName: team.effective.teamName, submittedDate: item.submittedDate, matchStatus: matched ? 'Matched' : 'NotMatched', applicant: { name: candidate.name, college: candidate.college, sex: candidate.sex, skillTags: [...candidate.skillTags], briefCv: candidate.briefCv } }
    })
    return success('CAPTAIN_QUEUE', 'Sanitized Pending queue loaded.', data)
  }

  approve(applicationId: string): MockResult {
    const auth = this.authorizeCaptainApplication(applicationId)
    if (!auth.ok || !auth.application || !auth.team) return failure(auth.code, auth.message)
    const item = auth.application
    const team = auth.team
    const competition = this.competition(item.competitionId)
    if (item.status !== 'Pending') return failure('APPLICATION_NOT_PENDING', 'Cannot process this application: it is no longer Pending.')
    if (team.lifecycle !== 'Active') return failure('TEAM_DISSOLVED', 'Cannot process this application: the team is dissolved.')
    if (competition.deadlineStatus === 'AfterDeadline') return failure('DEADLINE_PASSED', 'Cannot process this application: registration has closed.')
    if (this.hasActiveMembership(item.studentId, item.competitionId)) return failure('MEMBERSHIP_EXISTS', 'Cannot process this application: the applicant already has a current team.')
    if (this.memberCount(team.id) >= team.effective.capacity) return failure('TEAM_FULL', 'This team is full.')
    item.status = 'Approved'; item.updatedDate = '2026-10-27'; item.reason = 'Approved by the current captain.'
    this.sequence += 1
    this.memberships.push(membership(`membership-demo-${this.sequence}`, item.competitionId, item.teamId, item.studentId, 'Active', 'Member'))
    this.invalidateWhere((record) => record.studentId === item.studentId && record.competitionId === item.competitionId && record.id !== item.id, 'Applicant joined another team in this competition.')
    if (this.memberCount(team.id) >= team.effective.capacity) {
      team.recruitmentSwitch = 'Closed'
      this.invalidateWhere((record) => record.teamId === team.id && record.id !== item.id, 'Team reached capacity.')
    }
    return success('APPLICATION_APPROVED', 'Application approved; membership created in Mock state.')
  }

  reject(applicationId: string): MockResult {
    const auth = this.authorizeCaptainApplication(applicationId)
    if (!auth.ok || !auth.application) return failure(auth.code, auth.message)
    if (auth.application.status !== 'Pending') return failure('APPLICATION_NOT_PENDING', 'Cannot process this application: it is no longer Pending.')
    auth.application.status = 'Rejected'; auth.application.updatedDate = '2026-10-27'; auth.application.reason = 'Rejected by the current captain.'
    return success('APPLICATION_REJECTED', 'Application rejected; history retained.')
  }

  createTeam(command: CreateTeamCommand): MockResult<Record<string, unknown>> {
    const actor = this.getActor()
    if (!this.isStudentActor(actor)) return failure('STUDENT_REQUIRED', 'Select a logged-in student persona.')
    const student = this.profile(actor.studentId)
    if (!student.profileComplete) return failure('PROFILE_INCOMPLETE', 'Complete the student profile before creating a team.')
    const competition = this.competitions.find((item) => item.id === command.competitionId)
    if (!competition) return failure('COMPETITION_NOT_FOUND', 'Competition not found.')
    if (!student.eligibleCompetitionIds.includes(competition.id)) return failure('COMPETITION_INELIGIBLE', 'The selected student is not eligible for this competition.')
    if (competition.deadlineStatus === 'AfterDeadline') return failure('DEADLINE_PASSED', 'Registration closed. New teams cannot be created.')
    if (this.hasActiveMembership(student.studentId, competition.id)) return failure('MEMBERSHIP_EXISTS', 'You already have a current team in this competition.')
    const validation = this.validateSettings(command, 1, competition.maximumTeamSize)
    if (!validation.ok) return failure(validation.code, validation.message)
    this.sequence += 1
    const teamId = `team-created-${this.sequence}`
    const effective = settings(command.name.trim(), command.summary.trim(), command.capacity, unique(command.requiredSkills))
    const created: MockTeamRecord = {
      id: teamId, competitionId: competition.id, captainActorId: actor.id, lifecycle: 'Active',
      publication: command.submitRecruitment ? 'Pending' : 'Private', recruitmentSwitch: 'Open', effective,
      draft: command.submitRecruitment ? cloneSettings(effective) : undefined,
      draftRevisionId: command.submitRecruitment ? `recruitment-revision-${this.sequence}` : undefined,
      reviewHistory: [], hasApprovedRecruitment: false, demoMatchStatus: 'Matched',
    }
    this.teams.push(created)
    this.memberships.push(membership(`membership-${teamId}-captain`, competition.id, teamId, student.studentId, 'Active', 'Captain'))
    this.invalidateWhere((record) => record.studentId === student.studentId && record.competitionId === competition.id, 'Applicant created a team in this competition.')
    return success('TEAM_CREATED', command.submitRecruitment ? 'Team created. Initial recruitment submitted for Mock review.' : 'Team created privately. Recruitment was not submitted.', this.myTeamItem(created, this.memberships[this.memberships.length - 1]))
  }

  listMyTeams(): MockResult<Record<string, unknown>> {
    const actor = this.getActor()
    if (!actor.studentId || actor.role === 'Visitor' || actor.role === 'Admin') return failure('STUDENT_REQUIRED', 'Select a student persona to view team memberships.')
    const rows = this.memberships.filter((item) => item.studentId === actor.studentId)
    return success('MY_TEAMS', 'Team memberships loaded.', {
      current: rows.filter((item) => item.status === 'Active').map((item) => this.myTeamItem(this.team(item.teamId), item)),
      history: rows.filter((item) => item.status === 'Ended').map((item) => this.myTeamItem(this.team(item.teamId), item)),
    })
  }

  getRecruitmentManagement(teamId: string): MockResult<Record<string, unknown>> {
    const auth = this.authorizeCaptain(teamId)
    if (!auth.ok || !auth.team) return failure(auth.code, auth.message)
    return success('RECRUITMENT_MANAGEMENT', 'Recruitment management loaded.', this.recruitmentManagement(auth.team))
  }

  setRecruitmentSwitch(teamId: string, value: 'Open' | 'Closed'): MockResult<Record<string, unknown>> {
    const auth = this.authorizeCaptain(teamId)
    if (!auth.ok || !auth.team) return failure(auth.code, auth.message)
    const team = auth.team
    if (team.lifecycle !== 'Active') return failure('TEAM_DISSOLVED', 'A dissolved team cannot change recruitment.')
    if (value === 'Open') {
      const competition = this.competition(team.competitionId)
      if (team.publication !== 'Published') return failure('RECRUITMENT_NOT_PUBLISHED', 'Only a Published recruitment can open to new applications.')
      if (competition.deadlineStatus === 'AfterDeadline') return failure('DEADLINE_PASSED', 'Registration closed. Recruitment cannot reopen.')
      if (this.memberCount(team.id) >= team.effective.capacity) return failure('TEAM_FULL', 'This team is full.')
    }
    team.recruitmentSwitch = value
    return success('RECRUITMENT_SWITCH_UPDATED', value === 'Open' ? 'Recruitment opened manually.' : 'Recruitment closed manually. Existing eligible Pending applications remain reviewable.', this.recruitmentManagement(team))
  }

  submitRecruitmentRevision(teamId: string, command: RecruitmentSettingsRecord): MockResult<Record<string, unknown>> {
    const auth = this.authorizeCaptain(teamId)
    if (!auth.ok || !auth.team) return failure(auth.code, auth.message)
    const team = auth.team
    if (team.lifecycle !== 'Active') return failure('TEAM_DISSOLVED', 'A dissolved team cannot submit recruitment.')
    if (team.publication === 'Pending' || team.publication === 'Delisted') return failure('REVISION_ALREADY_PENDING', 'A recruitment version is already under review.')
    const competition = this.competition(team.competitionId)
    const validation = this.validateSettings({ name: command.teamName, summary: command.summary, capacity: command.capacity, requiredSkills: command.requiredSkills }, this.memberCount(team.id), competition.maximumTeamSize)
    if (!validation.ok) return failure(validation.code, validation.message)
    this.sequence += 1
    team.draft = settings(command.teamName.trim(), command.summary.trim(), command.capacity, unique(command.requiredSkills))
    team.draftRevisionId = `recruitment-revision-${this.sequence}`
    team.publication = team.hasApprovedRecruitment ? 'Delisted' : 'Pending'
    return success('RECRUITMENT_SUBMITTED', team.hasApprovedRecruitment ? 'Revision submitted. The public recruitment is now Delisted.' : 'Initial recruitment submitted for Mock review.', this.recruitmentManagement(team))
  }

  moderateRecruitment(teamId: string, decision: 'Approve' | 'Reject'): MockResult<Record<string, unknown>> {
    const actor = this.getActor()
    if (actor.role !== 'Admin') return failure('ADMIN_REQUIRED', 'Only the explicitly selected Admin reviewer can moderate a recruitment version.')
    const team = this.teams.find((item) => item.id === teamId)
    if (!team || !team.draft || !team.draftRevisionId || !['Pending', 'Delisted'].includes(team.publication)) return failure('NO_REVIEWABLE_DRAFT', 'No current Pending recruitment revision is available. A rejected revision must be resubmitted by the current captain.')
    if (decision === 'Reject') {
      team.reviewHistory.push({ revisionId: team.draftRevisionId, decision: 'Rejected', settings: cloneSettings(team.draft) })
      team.publication = 'Rejected'
      return success('RECRUITMENT_REJECTED', 'Draft rejected. Recruitment remains unavailable publicly.', this.recruitmentManagement(team))
    }
    const competition = this.competition(team.competitionId)
    if (team.lifecycle !== 'Active') return failure('TEAM_DISSOLVED', 'Cannot approve draft: the team is no longer active.')
    if (competition.deadlineStatus === 'AfterDeadline') return failure('DEADLINE_PASSED', 'Cannot approve draft: competition registration has closed.')
    if (!this.hasCurrentCaptain(team)) return failure('CAPTAIN_MEMBERSHIP_MISSING', 'Cannot approve draft: the team no longer has its current active captain membership.')
    const validation = this.validateSettings({ name: team.draft.teamName, summary: team.draft.summary, capacity: team.draft.capacity, requiredSkills: team.draft.requiredSkills }, this.memberCount(team.id), competition.maximumTeamSize)
    if (!validation.ok) return failure(validation.code, `Cannot approve draft: ${validation.message}`)
    team.reviewHistory.push({ revisionId: team.draftRevisionId, decision: 'Approved', settings: cloneSettings(team.draft) })
    team.effective = cloneSettings(team.draft)
    team.draft = undefined
    team.draftRevisionId = undefined
    team.publication = 'Published'
    team.hasApprovedRecruitment = true
    return success('RECRUITMENT_APPROVED', 'Draft approved and promoted to the effective Published version. Recruitment switch was not changed.', this.recruitmentManagement(team))
  }

  getTeamOperations(teamId: string): MockResult<Record<string, unknown>> {
    const actor = this.getActor()
    const team = this.teams.find((item) => item.id === teamId)
    if (!team || !actor.studentId) return failure('MEMBERSHIP_REQUIRED', 'Current active team membership is required.')
    const ownMembership = this.activeMembership(team.id, actor.studentId)
    if (!ownMembership || team.lifecycle !== 'Active') return failure('MEMBERSHIP_REQUIRED', 'Current active team membership is required.')
    const members = this.activeMemberships(team.id).map((item) => ({ membershipId: item.id, username: this.safeUsername(item.studentId), role: item.role, status: item.status }))
    return success('TEAM_OPERATIONS', 'Active team members loaded without contact fields.', { team: this.myTeamItem(team, ownMembership), members })
  }

  getActiveMemberContacts(teamId: string): MockResult<Array<Record<string, unknown>>> {
    const auth = this.authorizeCaptain(teamId)
    if (!auth.ok || !auth.team) return failure(auth.code, auth.message)
    const contacts = this.activeMemberships(teamId).filter((item) => item.role === 'Member').map((item) => {
      const memberProfile = this.profiles().find((profileItem) => profileItem.studentId === item.studentId)
      return { membershipId: item.id, memberName: this.safeUsername(item.studentId), wechatId: memberProfile?.wechatId, qqId: memberProfile?.qqId }
    })
    return success('ACTIVE_MEMBER_CONTACTS', 'Current active-member contacts loaded for the current captain.', contacts)
  }

  leaveTeam(teamId: string): MockResult {
    const actor = this.getActor()
    if (!actor.studentId) return failure('MEMBERSHIP_REQUIRED', 'Current active team membership is required.')
    const team = this.teams.find((item) => item.id === teamId)
    const ownMembership = team ? this.activeMembership(team.id, actor.studentId) : undefined
    if (!team || !ownMembership || team.lifecycle !== 'Active') return failure('MEMBERSHIP_REQUIRED', 'Current active team membership is required.')
    if (ownMembership.role === 'Captain') return failure('CAPTAIN_CANNOT_LEAVE', 'Captain cannot leave directly. Transfer captaincy or dissolve the team first.')
    ownMembership.status = 'Ended'
    return success('MEMBER_LEFT', 'You left the team. Historical membership was retained and recruitment was not reopened.')
  }

  removeMember(teamId: string, membershipId: string): MockResult {
    const auth = this.authorizeCaptain(teamId)
    if (!auth.ok || !auth.team) return failure(auth.code, auth.message)
    const target = this.memberships.find((item) => item.id === membershipId && item.teamId === teamId && item.status === 'Active')
    if (!target) return failure('ACTIVE_MEMBER_NOT_FOUND', 'Active member not found.')
    if (target.role === 'Captain') return failure('CANNOT_REMOVE_CAPTAIN', 'The captain cannot be removed as a member.')
    target.status = 'Ended'
    return success('MEMBER_REMOVED', 'Member removed. Historical membership was retained and recruitment was not reopened.')
  }

  transferCaptain(teamId: string, membershipId: string): MockResult {
    const auth = this.authorizeCaptain(teamId)
    if (!auth.ok || !auth.team) return failure(auth.code, auth.message)
    const target = this.memberships.find((item) => item.id === membershipId && item.teamId === teamId && item.status === 'Active' && item.role === 'Member')
    if (!target) return failure('INVALID_TRANSFER_TARGET', 'Captaincy can transfer only to an existing active member.')
    const targetProfile = this.profile(target.studentId)
    if (!targetProfile.actorId) return failure('INVALID_TRANSFER_TARGET', 'The selected active member has no interactive prototype persona.')
    const currentCaptain = this.activeMemberships(teamId).find((item) => item.role === 'Captain')
    if (!currentCaptain) return failure('CAPTAIN_MEMBERSHIP_MISSING', 'Current captain membership is unavailable.')
    currentCaptain.role = 'Member'
    target.role = 'Captain'
    auth.team.captainActorId = targetProfile.actorId
    return success('CAPTAIN_TRANSFERRED', `Captaincy transferred immediately to @${targetProfile.username}.`)
  }

  dissolveTeam(teamId: string): MockResult {
    const auth = this.authorizeCaptain(teamId)
    if (!auth.ok || !auth.team) return failure(auth.code, auth.message)
    auth.team.lifecycle = 'Dissolved'
    auth.team.publication = 'Delisted'
    auth.team.recruitmentSwitch = 'Closed'
    this.activeMemberships(teamId).forEach((item) => { item.status = 'Ended' })
    this.invalidateWhere((record) => record.teamId === teamId, 'Team was dissolved.')
    return success('TEAM_DISSOLVED', 'Team dissolved. Pending applications were invalidated and owner-specific history was retained.')
  }

  applyNamedScenario(name: 'manual-closed' | 'revision-delisted' | 'full' | 'deadline-expired' | 'dissolved' | 'captain-transferred' | 'former-member' | 'cross-competition-open'): MockResult {
    const alpha = this.team('team-alpha')
    if (name === 'manual-closed') alpha.recruitmentSwitch = 'Closed'
    if (name === 'revision-delisted') { alpha.draft = settings('Team Alpha Revision', 'Pending revision fixture.', 4, ['Python']); alpha.draftRevisionId = 'recruitment-revision-alpha-scenario'; alpha.publication = 'Delisted' }
    if (name === 'full') {
      while (this.memberCount(alpha.id) < alpha.effective.capacity) {
        this.sequence += 1
        this.memberships.push(membership(`membership-full-${this.sequence}`, alpha.competitionId, alpha.id, `student-full-${this.sequence}`, 'Active', 'Member'))
      }
      alpha.recruitmentSwitch = 'Closed'
      this.invalidateWhere((record) => record.teamId === alpha.id, 'Team reached capacity.')
    }
    if (name === 'deadline-expired') { this.competition('competition-demo-1').deadlineStatus = 'AfterDeadline'; this.invalidateWhere((record) => record.competitionId === 'competition-demo-1', 'Competition registration deadline passed.') }
    if (name === 'dissolved') { alpha.lifecycle = 'Dissolved'; alpha.publication = 'Delisted'; alpha.recruitmentSwitch = 'Closed'; this.invalidateWhere((record) => record.teamId === alpha.id, 'Team was dissolved.') }
    if (name === 'captain-transferred') { this.selectedActorId = 'captain-alpha'; return this.transferCaptain(alpha.id, 'membership-alpha-member') }
    if (name === 'former-member' && !this.memberships.some((item) => item.studentId === 'student-alex' && item.competitionId === 'competition-demo-1')) this.memberships.push(membership('membership-ended-alex', 'competition-demo-1', 'team-alpha', 'student-alex', 'Ended', 'Member'))
    if (name === 'cross-competition-open') this.competition('competition-demo-2').deadlineStatus = 'BeforeDeadline'
    return success('SCENARIO_APPLIED', `Named Mock scenario applied: ${name}.`)
  }

  private resolveActor(seed: MockActorRecord): MockActorRecord {
    const captainedTeam = this.teams.find((teamItem) => teamItem.captainActorId === seed.id && teamItem.lifecycle === 'Active')
    if (captainedTeam) return { ...seed, role: 'CurrentCaptain', captainTeamId: captainedTeam.id, skillTags: seed.skillTags ? [...seed.skillTags] : undefined }
    if (seed.role === 'CurrentCaptain') return { ...seed, role: 'FormerCaptain', captainTeamId: undefined, skillTags: seed.skillTags ? [...seed.skillTags] : undefined }
    return { ...seed, skillTags: seed.skillTags ? [...seed.skillTags] : undefined }
  }

  private isPublic(teamItem: MockTeamRecord): boolean { return teamItem.lifecycle === 'Active' && teamItem.publication === 'Published' }
  private publicRecruitment(teamItem: MockTeamRecord): Record<string, unknown> {
    const competition = this.competition(teamItem.competitionId)
    const count = this.memberCount(teamItem.id)
    const availability = competition.deadlineStatus === 'AfterDeadline' ? 'RegistrationClosed' : count >= teamItem.effective.capacity ? 'Full' : teamItem.recruitmentSwitch === 'Closed' ? 'ManuallyClosed' : 'Open'
    return {
      id: teamItem.id, competitionId: teamItem.competitionId, competitionTitle: competition.title, competitionDeadline: competition.deadline,
      name: teamItem.effective.teamName, captainUsername: this.captainUsername(teamItem), summary: teamItem.effective.summary,
      memberCount: count, capacity: teamItem.effective.capacity, lifecycle: teamItem.lifecycle, publication: teamItem.publication,
      recruitmentSwitch: teamItem.recruitmentSwitch, requiredSkills: [...teamItem.effective.requiredSkills], matchStatus: teamItem.demoMatchStatus,
      availability, isPubliclyListed: true,
    }
  }

  private reviewRecruitment(teamItem: MockTeamRecord): Record<string, unknown> {
    const base = this.publicLikeRecruitment(teamItem)
    return { ...base, revisionDraft: teamItem.draft ? cloneSettings(teamItem.draft) : undefined }
  }

  private publicLikeRecruitment(teamItem: MockTeamRecord): Record<string, unknown> {
    const competition = this.competition(teamItem.competitionId)
    return {
      id: teamItem.id, competitionId: teamItem.competitionId, competitionTitle: competition.title, competitionDeadline: competition.deadline,
      name: teamItem.effective.teamName, captainUsername: this.captainUsername(teamItem), summary: teamItem.effective.summary,
      memberCount: this.memberCount(teamItem.id), capacity: teamItem.effective.capacity, lifecycle: teamItem.lifecycle,
      publication: teamItem.publication, recruitmentSwitch: teamItem.recruitmentSwitch, requiredSkills: [...teamItem.effective.requiredSkills],
      matchStatus: teamItem.demoMatchStatus, availability: teamItem.publication === 'Published' ? this.publicRecruitment(teamItem).availability : 'Delisted', isPubliclyListed: false,
    }
  }

  private recruitmentManagement(teamItem: MockTeamRecord): Record<string, unknown> {
    const competition = this.competition(teamItem.competitionId)
    return {
      teamId: teamItem.id, competitionId: competition.id, competitionTitle: competition.title, competitionMaximumTeamSize: competition.maximumTeamSize,
      memberCount: this.memberCount(teamItem.id), lifecycle: teamItem.lifecycle, publication: teamItem.publication, recruitmentSwitch: teamItem.recruitmentSwitch,
      effective: cloneSettings(teamItem.effective), draft: teamItem.draft ? cloneSettings(teamItem.draft) : undefined,
      draftRevisionId: teamItem.draftRevisionId,
      reviewHistory: teamItem.reviewHistory.map((item) => ({ revisionId: item.revisionId, decision: item.decision, settings: cloneSettings(item.settings) })),
      canModerateInPrototype: this.getActor().role === 'Admin',
    }
  }

  private myTeamItem(teamItem: MockTeamRecord, membershipItem: MockMembershipRecord): Record<string, unknown> {
    const current = membershipItem.status === 'Active' && teamItem.lifecycle === 'Active'
    const captain = current && membershipItem.role === 'Captain' && teamItem.captainActorId === this.selectedActorId
    return {
      id: teamItem.id, name: teamItem.effective.teamName, competitionId: teamItem.competitionId, competitionTitle: this.competition(teamItem.competitionId).title,
      memberCount: this.memberCount(teamItem.id), capacity: teamItem.effective.capacity, lifecycle: teamItem.lifecycle, publication: teamItem.publication,
      recruitmentSwitch: teamItem.recruitmentSwitch, membershipId: membershipItem.id, membershipStatus: membershipItem.status,
      membershipRole: membershipItem.role, captainUsername: this.captainUsername(teamItem), canManageRecruitment: captain,
      canReviewApplications: captain, canManageMembers: captain, canLeave: current && membershipItem.role === 'Member',
    }
  }

  private applicationResponse(item: MockApplicationRecord): Record<string, unknown> { return { ...item, isCurrentMembership: this.hasActiveMembership(item.studentId, item.competitionId, item.teamId), canWithdraw: item.status === 'Pending', canReapply: ['Rejected', 'Withdrawn', 'Invalidated'].includes(item.status) } }

  private checkFreshApplication(studentId: string, teamId: string): MockResult {
    const teamItem = this.teams.find((item) => item.id === teamId)
    if (!teamItem) return failure('TEAM_NOT_FOUND', 'Recruitment not found.')
    const student = this.profile(studentId)
    const competition = this.competition(teamItem.competitionId)
    if (!student.profileComplete) return failure('PROFILE_INCOMPLETE', 'Complete the student profile before applying to a team.')
    if (!student.eligibleCompetitionIds.includes(competition.id)) return failure('COMPETITION_INELIGIBLE', 'The selected student is not eligible for this competition.')
    if (this.hasActiveMembership(studentId, teamItem.competitionId)) return failure('MEMBERSHIP_EXISTS', 'You already have a current team in this competition.')
    if (this.applications.some((item) => item.studentId === studentId && item.teamId === teamId && item.status === 'Pending')) return failure('PENDING_EXISTS', 'A Pending application already exists for this team.')
    if (teamItem.lifecycle !== 'Active') return failure('TEAM_DISSOLVED', 'This team is dissolved.')
    if (competition.deadlineStatus === 'AfterDeadline') return failure('DEADLINE_PASSED', 'Registration closed. New applications are unavailable.')
    if (teamItem.publication !== 'Published') return failure('RECRUITMENT_NOT_PUBLIC', 'Recruitment is not publicly available.')
    if (this.memberCount(teamItem.id) >= teamItem.effective.capacity) return failure('TEAM_FULL', 'This team is full.')
    if (teamItem.recruitmentSwitch !== 'Open') return failure('RECRUITMENT_CLOSED', 'Recruitment is manually closed.')
    return success('ELIGIBLE', 'Eligible to apply.')
  }

  private authorizeCaptain(teamId?: string): { ok: boolean; code: string; message: string; team?: MockTeamRecord } {
    const actor = this.getActor()
    if (actor.role !== 'CurrentCaptain' || !actor.captainTeamId) return { ok: false, code: 'CAPTAIN_REQUIRED', message: 'Only the current captain can perform this operation.' }
    const scopedTeamId = teamId || actor.captainTeamId
    const teamItem = this.teams.find((item) => item.id === scopedTeamId && item.captainActorId === actor.id && item.lifecycle === 'Active')
    if (teamId && !teamItem) return { ok: false, code: 'OUT_OF_SCOPE', message: 'This team is outside the captain\'s current scope.' }
    const captainMembership = actor.studentId ? this.activeMembership(scopedTeamId, actor.studentId) : undefined
    if (!captainMembership || captainMembership.role !== 'Captain') return { ok: false, code: 'CAPTAIN_SCOPE_CHANGED', message: 'Captain authorization is no longer current for this team.' }
    if (!teamItem) return { ok: false, code: 'CAPTAIN_SCOPE_CHANGED', message: 'Captain authorization is no longer current for this team.' }
    return { ok: true, code: 'AUTHORIZED', message: 'Authorized.', team: teamItem }
  }

  private authorizeCaptainApplication(applicationId: string): { ok: boolean; code: string; message: string; application?: MockApplicationRecord; team?: MockTeamRecord } {
    const item = this.applications.find((record) => record.id === applicationId)
    if (!item) return { ok: false, code: 'OUT_OF_SCOPE', message: 'This application is outside the captain\'s current team.' }
    const auth = this.authorizeCaptain(item.teamId)
    if (!auth.ok || !auth.team) return auth
    return { ...auth, application: item }
  }

  private validateSettings(command: { name: string; summary: string; capacity: number; requiredSkills: string[] }, minimumCapacity: number, maximumCapacity: number): MockResult {
    if (!command.name.trim() || !command.summary.trim()) return failure('REQUIRED_FIELDS', 'Team name and summary are required.')
    if (!Number.isInteger(command.capacity)) return failure('INVALID_CAPACITY', 'Maximum members must be a whole number.')
    if (command.capacity < minimumCapacity) return failure('CAPACITY_BELOW_MEMBERS', `Maximum members cannot be below the ${minimumCapacity} active member(s).`)
    if (command.capacity > maximumCapacity) return failure('CAPACITY_ABOVE_LIMIT', `Maximum members cannot exceed the competition limit of ${maximumCapacity}.`)
    if (unique(command.requiredSkills).length === 0) return failure('SKILL_REQUIRED', 'Select at least one preset required skill tag.')
    return success('VALID', 'Settings are valid.')
  }

  private invalidateWhere(predicate: (item: MockApplicationRecord) => boolean, reason: string): void {
    this.applications.forEach((item) => { if (item.status === 'Pending' && predicate(item)) { item.status = 'Invalidated'; item.updatedDate = '2026-10-27'; item.reason = reason } })
  }

  private hasActiveMembership(studentId: string, competitionId: string, teamId?: string): boolean { return this.memberships.some((item) => item.studentId === studentId && item.competitionId === competitionId && item.status === 'Active' && (!teamId || item.teamId === teamId)) }
  private activeMembership(teamId: string, studentId: string): MockMembershipRecord | undefined { return this.memberships.find((item) => item.teamId === teamId && item.studentId === studentId && item.status === 'Active') }
  private activeMemberships(teamId: string): MockMembershipRecord[] { return this.memberships.filter((item) => item.teamId === teamId && item.status === 'Active') }
  private memberCount(teamId: string): number { return this.activeMemberships(teamId).length }
  private hasCurrentCaptain(teamItem: MockTeamRecord): boolean {
    const captainActor = actorSeeds.find((item) => item.id === teamItem.captainActorId)
    return Boolean(captainActor?.studentId && this.memberships.some((item) => item.teamId === teamItem.id && item.studentId === captainActor.studentId && item.status === 'Active' && item.role === 'Captain'))
  }
  private isStudentActor(actor: MockActorRecord): actor is MockActorRecord & { studentId: string } { return Boolean(actor.studentId && actor.role !== 'Visitor' && actor.role !== 'Admin') }
  private team(teamId: string): MockTeamRecord { const item = this.teams.find((teamItem) => teamItem.id === teamId); if (!item) throw new Error(`Unknown team ${teamId}`); return item }
  private competition(competitionId: string): MockCompetitionRecord { const item = this.competitions.find((competitionItem) => competitionItem.id === competitionId); if (!item) throw new Error(`Unknown competition ${competitionId}`); return item }
  private profiles(): ApplicantProfileSource[] { return profileSeeds }
  private profile(studentId: string): ApplicantProfileSource { const item = profileSeeds.find((profileItem) => profileItem.studentId === studentId); if (!item) throw new Error(`Unknown profile ${studentId}`); return item }
  private safeUsername(studentId: string): string { return profileSeeds.find((item) => item.studentId === studentId)?.username || `member_${studentId.slice(-4)}` }
  private captainUsername(teamItem: MockTeamRecord): string { const actor = actorSeeds.find((item) => item.id === teamItem.captainActorId); return actor?.studentId ? this.safeUsername(actor.studentId) : teamItem.captainActorId.replace('captain-', '') + '_lead' }
}

function unique(values: string[]): string[] { return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))) }
function cloneSettings(value: RecruitmentSettingsRecord): RecruitmentSettingsRecord { return { ...value, requiredSkills: [...value.requiredSkills] } }
function success<T = undefined>(code: string, message: string, data?: T): MockResult<T> { return { ok: true, code, message, data } }
function failure<T = undefined>(code: string, message: string): MockResult<T> { return { ok: false, code, message } }

export const mockBusinessState = new MockBusinessState()
