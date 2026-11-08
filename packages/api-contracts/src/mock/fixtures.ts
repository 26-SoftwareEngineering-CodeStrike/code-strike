import {
  ApplicationStatus,
  CompetitionDeadlineStatus,
  RecruitmentPublicationStatus,
  RecruitmentSwitch,
  TeamLifecycle,
} from '../enums'
import type { ApplicationSummary, CompetitionSummary, TeamStateSummary } from '../types'

export const mockCompetitions: CompetitionSummary[] = [
  {
    id: 'competition-demo-1',
    title: '2026 University Innovation Challenge',
    category: 'Innovation',
    registrationDeadline: '2026-12-15T16:00:00Z',
    deadlineStatus: CompetitionDeadlineStatus.BeforeDeadline,
  },
  {
    id: 'competition-demo-2',
    title: 'Campus Mathematical Modeling Contest',
    category: 'Mathematics',
    registrationDeadline: '2026-09-20T16:00:00Z',
    deadlineStatus: CompetitionDeadlineStatus.AfterDeadline,
  },
]

export const mockApplications: ApplicationSummary[] = [
  {
    id: 'application-demo-1',
    competitionId: 'competition-demo-1',
    teamName: 'Team Alpha',
    status: ApplicationStatus.Pending,
  },
]

export const mockTeam: TeamStateSummary = {
  id: 'team-demo-1',
  name: 'Team Alpha',
  memberCount: 2,
  capacity: 4,
  lifecycle: TeamLifecycle.Active,
  publication: RecruitmentPublicationStatus.Published,
  recruitmentSwitch: RecruitmentSwitch.Open,
}

