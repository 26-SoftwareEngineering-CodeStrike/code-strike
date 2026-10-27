import {
  mockCompetitionDetails,
  mockCompetitions,
} from '@codestrike/contracts/mock'
import type { ApiRequest, ApiTransport } from './transport'
import { mockBusinessState } from '../mock/business-state'
import { plannerMockState } from '../mock/planner-state'

export class MockTransport implements ApiTransport {
  async request<T>(request: ApiRequest): Promise<T> {
    await waitForMockLatency()

    const method = request.method || 'GET'

    if (method === 'GET' && request.path === '/prototype/actors') {
      return mockBusinessState.listActors() as T
    }

    if (method === 'GET' && request.path === '/prototype/actor') {
      return mockBusinessState.getActor() as T
    }

    if (method === 'POST' && request.path === '/prototype/actor') {
      return mockBusinessState.selectActor(readBodyId(request.body, 'actorId')) as T
    }

    if (method === 'GET' && request.path === '/applications/mine') {
      return mockBusinessState.listApplicationHistory() as T
    }

    if (method === 'POST' && request.path === '/applications') {
      return mockBusinessState.apply(readBodyId(request.body, 'teamId')) as T
    }

    const withdrawMatch = request.path.match(/^\/applications\/([^/]+)\/withdraw$/)
    if (method === 'POST' && withdrawMatch) {
      return mockBusinessState.withdraw(withdrawMatch[1]) as T
    }

    const reapplyMatch = request.path.match(/^\/applications\/([^/]+)\/reapply$/)
    if (method === 'POST' && reapplyMatch) {
      return mockBusinessState.reapply(reapplyMatch[1]) as T
    }

    if (method === 'GET' && request.path === '/captain/applications') {
      return mockBusinessState.listCaptainQueue() as T
    }

    const captainTeamApplicationsMatch = request.path.match(/^\/captain\/teams\/([^/]+)\/applications$/)
    if (method === 'GET' && captainTeamApplicationsMatch) {
      return mockBusinessState.listCaptainQueue(captainTeamApplicationsMatch[1]) as T
    }

    const approveMatch = request.path.match(/^\/captain\/applications\/([^/]+)\/approve$/)
    if (method === 'POST' && approveMatch) {
      return mockBusinessState.approve(approveMatch[1]) as T
    }

    const rejectMatch = request.path.match(/^\/captain\/applications\/([^/]+)\/reject$/)
    if (method === 'POST' && rejectMatch) {
      return mockBusinessState.reject(rejectMatch[1]) as T
    }

    if (method === 'POST' && request.path === '/teams') {
      return mockBusinessState.createTeam(readObjectBody(request.body) as never) as T
    }

    if (method === 'GET' && request.path === '/teams/mine') {
      return mockBusinessState.listMyTeams() as T
    }

    const recruitmentManagementMatch = request.path.match(/^\/teams\/([^/]+)\/recruitment$/)
    if (method === 'GET' && recruitmentManagementMatch) {
      return mockBusinessState.getRecruitmentManagement(recruitmentManagementMatch[1]) as T
    }

    const recruitmentSwitchMatch = request.path.match(/^\/teams\/([^/]+)\/recruitment-switch$/)
    if (method === 'PUT' && recruitmentSwitchMatch) {
      const value = readObjectBody(request.body).value
      if (value !== 'Open' && value !== 'Closed') throw new Error('Invalid recruitment switch.')
      return mockBusinessState.setRecruitmentSwitch(recruitmentSwitchMatch[1], value) as T
    }

    const recruitmentRevisionMatch = request.path.match(/^\/teams\/([^/]+)\/recruitment-revision$/)
    if (method === 'POST' && recruitmentRevisionMatch) {
      return mockBusinessState.submitRecruitmentRevision(recruitmentRevisionMatch[1], readObjectBody(request.body) as never) as T
    }

    const moderationMatch = request.path.match(/^\/prototype\/recruitment-reviews\/([^/]+)\/moderate$/)
    if (method === 'POST' && moderationMatch) {
      const decision = readObjectBody(request.body).decision
      if (decision !== 'Approve' && decision !== 'Reject') throw new Error('Invalid moderation decision.')
      return mockBusinessState.moderateRecruitment(moderationMatch[1], decision) as T
    }

    const operationsMatch = request.path.match(/^\/teams\/([^/]+)\/operations$/)
    if (method === 'GET' && operationsMatch) {
      return mockBusinessState.getTeamOperations(operationsMatch[1]) as T
    }

    const contactsMatch = request.path.match(/^\/teams\/([^/]+)\/member-contacts$/)
    if (method === 'GET' && contactsMatch) {
      return mockBusinessState.getActiveMemberContacts(contactsMatch[1]) as T
    }

    const leaveMatch = request.path.match(/^\/teams\/([^/]+)\/leave$/)
    if (method === 'POST' && leaveMatch) {
      return mockBusinessState.leaveTeam(leaveMatch[1]) as T
    }

    const removeMemberMatch = request.path.match(/^\/teams\/([^/]+)\/members\/([^/]+)\/remove$/)
    if (method === 'POST' && removeMemberMatch) {
      return mockBusinessState.removeMember(removeMemberMatch[1], removeMemberMatch[2]) as T
    }

    const transferMatch = request.path.match(/^\/teams\/([^/]+)\/captain\/transfer$/)
    if (method === 'POST' && transferMatch) {
      return mockBusinessState.transferCaptain(transferMatch[1], readBodyId(request.body, 'membershipId')) as T
    }

    const dissolveMatch = request.path.match(/^\/teams\/([^/]+)\/dissolve$/)
    if (method === 'POST' && dissolveMatch) {
      return mockBusinessState.dissolveTeam(dissolveMatch[1]) as T
    }

    const plannerViewMatch = request.path.match(/^\/planner\/views\/(Day|Week)\/(\d{4}-\d{2}-\d{2})$/)
    if (method === 'GET' && plannerViewMatch) return plannerMockState.getView(plannerViewMatch[2], plannerViewMatch[1] as 'Day' | 'Week') as T
    if (method === 'GET' && request.path === '/planner/periods') return plannerMockState.listPeriods() as T
    if (method === 'POST' && request.path === '/planner/courses') return plannerMockState.createCourse(readObjectBody(request.body) as never) as T
    if (method === 'POST' && request.path === '/planner/items') return plannerMockState.createItem(readObjectBody(request.body) as never) as T
    const plannerCompleteMatch = request.path.match(/^\/planner\/occurrences\/([^/]+)\/complete$/)
    if (method === 'POST' && plannerCompleteMatch) return plannerMockState.toggleTodo(plannerCompleteMatch[1]) as T
    const plannerOccurrenceMatch = request.path.match(/^\/planner\/occurrences\/([^/]+)$/)
    if (plannerOccurrenceMatch && method === 'GET') return plannerMockState.getOccurrence(plannerOccurrenceMatch[1]) as T
    if (plannerOccurrenceMatch && method === 'PUT') return plannerMockState.updateOccurrence(plannerOccurrenceMatch[1], readObjectBody(request.body) as never) as T
    if (plannerOccurrenceMatch && method === 'DELETE') return plannerMockState.deleteOccurrence(plannerOccurrenceMatch[1]) as T

    if (method === 'GET' && request.path === '/competitions?scenario=error') {
      throw new Error('The prototype competition feed is unavailable.')
    }

    if (method === 'GET' && request.path === '/competitions') {
      return mockCompetitions.map((competition) => ({ ...competition })) as T
    }

    const competitionRecruitmentMatch = request.path.match(
      /^\/competitions\/([^/]+)\/recruitments$/,
    )
    if (method === 'GET' && competitionRecruitmentMatch) {
      const competitionId = competitionRecruitmentMatch[1]
      return mockBusinessState.listPublicRecruitments(competitionId) as T
    }

    const competitionMatch = request.path.match(/^\/competitions\/([^/]+)$/)
    if (method === 'GET' && competitionMatch) {
      const competition = mockCompetitionDetails.find(
        (item) => item.id === competitionMatch[1],
      )
      if (!competition) throw new Error('Competition not found.')
      return {
        ...competition,
        community: {
          ...competition.community,
          publishedRecruitmentCount: mockBusinessState.listPublicRecruitments(competition.id).length,
        },
      } as T
    }

    const recruitmentMatch = request.path.match(/^\/recruitments\/([^/]+)$/)
    if (method === 'GET' && recruitmentMatch) {
      const result = mockBusinessState.getPublicRecruitment(recruitmentMatch[1])
      if (!result.ok || !result.data) throw new Error(result.message)
      return result.data as T
    }

    const reviewMatch = request.path.match(/^\/prototype\/recruitment-reviews\/([^/]+)$/)
    if (method === 'GET' && reviewMatch) {
      const result = mockBusinessState.getRecruitmentReview(reviewMatch[1])
      if (!result.ok || !result.data) throw new Error(result.message)
      return result.data as T
    }

    throw new Error(`No mock registered for ${request.path}`)
  }
}

function waitForMockLatency(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 240))
}

function readBodyId(body: unknown, key: string): string {
  if (!body || typeof body !== 'object') throw new Error(`Missing ${key}.`)
  const value = (body as Record<string, unknown>)[key]
  if (typeof value !== 'string' || !value) throw new Error(`Missing ${key}.`)
  return value
}

function readObjectBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') throw new Error('Missing request body.')
  return body as Record<string, unknown>
}
