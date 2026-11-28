import type {
  ApiTransport,
  NotificationDto,
  NotificationInboxDto,
  NotificationReadRequest,
} from '@codestrike/contracts'

export type NotificationCategory = 'Admission' | 'Team' | 'Moderation' | 'General'

const EVENT_LABELS: Record<string, string> = {
  NewApplication: 'New team application',
  ApplicationApproved: 'Application approved',
  ApplicationRejected: 'Application rejected',
  ApplicationWithdrawn: 'Application withdrawn',
  ApplicationInvalidated: 'Application invalidated',
  MemberJoined: 'Member joined team',
  MemberDeparted: 'Member left team',
  MemberRemoved: 'Removed from team',
  CaptainTransferred: 'Captaincy transferred',
  TeamDissolved: 'Team dissolved',
  ModerationApprove: 'Content approved',
  ModerationReject: 'Content rejected',
  ModerationRemove: 'Content removed',
  ModerationApproved: 'Recruitment approved',
  ModerationRejected: 'Recruitment rejected',
  RecruitmentRemoved: 'Recruitment removed',
}

export function notificationLabel(event: string): string {
  return EVENT_LABELS[event] ?? event.replace(/([a-z])([A-Z])/g, '$1 $2')
}

export function notificationCategory(event: string): NotificationCategory {
  if (event.startsWith('Application') || event === 'NewApplication') return 'Admission'
  if (event.startsWith('Moderation') || event === 'RecruitmentRemoved') return 'Moderation'
  if (event.startsWith('Member') || event.startsWith('Captain') || event.startsWith('Team')) return 'Team'
  return 'General'
}

/**
 * Maps a notification target onto an existing student route. Target IDs carry
 * no authority; the destination screen always re-fetches and relies on backend
 * authorization for the signed-in account.
 */
export function notificationTargetUrl(item: NotificationDto): string | null {
  const { event, target } = item
  if (!target?.id) return null
  const id = encodeURIComponent(target.id)
  if (event === 'NewApplication') return '/pages/teams/index'
  if (target.type === 'application') return '/pages/applications/history'
  if (event === 'ModerationApproved' || event === 'ModerationRejected' || event === 'RecruitmentRemoved') {
    return `/pages/teams/recruitment?id=${id}`
  }
  if (target.type === 'team') return '/pages/teams/index'
  if (target.type === 'post') {
    if (event === 'ModerationRemove') return null
    const version = event === 'ModerationApprove' ? 'public' : 'mine'
    return `/pages/community/post?id=${id}&version=${version}`
  }
  if (target.type === 'competition') return '/pages/community/submissions'
  return null
}

export function createNotificationsApi(transport: ApiTransport) {
  const required = { auth: 'required' } as const
  const id = encodeURIComponent
  return {
    inbox: (offset = 0, limit = 50) =>
      transport.request<NotificationInboxDto>({
        path: '/notifications',
        query: { offset, limit },
        ...required,
      }),
    detail: (notificationId: string) =>
      transport.request<NotificationDto>({
        path: `/notifications/${id(notificationId)}`,
        ...required,
      }),
    setRead: (notificationId: string, isRead = true) => {
      const body: NotificationReadRequest = { isRead }
      return transport.request<NotificationDto>({
        path: `/notifications/${id(notificationId)}`,
        method: 'PATCH',
        body,
        ...required,
      })
    },
  }
}

export type NotificationsApi = ReturnType<typeof createNotificationsApi>
