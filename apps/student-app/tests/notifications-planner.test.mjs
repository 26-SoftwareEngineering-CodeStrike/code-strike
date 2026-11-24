import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '@codestrike/contracts/http'
import { createStudentApiClient } from '../src/api/client.ts'
import {
  notificationCategory,
  notificationLabel,
  notificationTargetUrl,
} from '../src/api/notifications.ts'
import {
  formatPlannerDeadline,
  formatPlannerTime,
  normalizePlannerDeadline,
} from '../src/api/planner.ts'

function recordingClient(routes) {
  const calls = []
  const transport = {
    async request(request) {
      const key = `${request.method ?? 'GET'} ${request.path}`
      calls.push({ ...request, key })
      const handler = routes[key]
      if (!handler) throw new Error(`Unexpected request: ${key}`)
      return typeof handler === 'function' ? handler(request) : handler
    },
  }
  return { api: createStudentApiClient({ mode: 'api', transport }), calls }
}

const sampleCourseDto = {
  id: 'course-1',
  recurrenceId: 'rec-1',
  kind: 'Course',
  title: 'Algorithms',
  date: '2026-09-07',
  startTime: '08:00:00',
  endTime: '09:40:00',
  startWeek: 1,
  weekday: 1,
  startPeriod: 1,
  endPeriod: 2,
  room: 'Room B204',
  description: null,
  deadline: null,
  completed: false,
  createdAt: '2026-09-01T08:00:00',
  updatedAt: '2026-09-01T08:00:00',
}

const sampleTodoDto = {
  id: 'todo-1',
  recurrenceId: null,
  kind: 'Todo',
  title: 'Submit slides',
  date: '2026-11-25',
  startTime: null,
  endTime: null,
  startWeek: null,
  weekday: null,
  startPeriod: null,
  endPeriod: null,
  room: null,
  description: 'Review metrics',
  deadline: '2026-11-26T23:59:00',
  completed: false,
  createdAt: '2026-11-24T10:00:00',
  updatedAt: '2026-11-24T10:00:00',
}

const samplePlanDto = {
  id: 'plan-1',
  recurrenceId: null,
  kind: 'TimedPlan',
  title: 'Team sync',
  date: '2026-11-25',
  startTime: '14:00:00',
  endTime: '15:00:00',
  startWeek: null,
  weekday: null,
  startPeriod: null,
  endPeriod: null,
  room: null,
  description: null,
  deadline: null,
  completed: false,
  createdAt: '2026-11-24T10:00:00',
  updatedAt: '2026-11-24T10:00:00',
}

test('notifications API reads inbox, fetches detail and updates read state with required auth', async () => {
  const row = {
    id: 'n-1',
    event: 'ApplicationApproved',
    message: 'Application approved.',
    isRead: false,
    target: { type: 'application', id: 'app-1' },
    createdAt: '2026-11-24T12:00:00',
  }
  const { api, calls } = recordingClient({
    'GET /notifications': ({ auth, query }) => {
      assert.equal(auth, 'required')
      assert.deepEqual(query, { offset: 0, limit: 20 })
      return { items: [row], unreadCount: 1 }
    },
    'GET /notifications/n-1': ({ auth }) => {
      assert.equal(auth, 'required')
      return row
    },
    'PATCH /notifications/n-1': ({ auth, body }) => {
      assert.equal(auth, 'required')
      assert.deepEqual(body, { isRead: true })
      return { ...row, isRead: true }
    },
  })

  assert.ok(api.notifications)
  const inbox = await api.notifications.inbox(0, 20)
  assert.equal(inbox.unreadCount, 1)
  assert.equal(inbox.items[0].id, 'n-1')

  const detail = await api.notifications.detail('n-1')
  assert.equal(detail.event, 'ApplicationApproved')

  const updated = await api.notifications.setRead('n-1', true)
  assert.equal(updated.isRead, true)
  assert.equal(calls.length, 3)

  const mockApi = createStudentApiClient({ mode: 'mock' })
  assert.equal(mockApi.notifications, null)
})

test('notification helpers classify admission, team and moderation events and map safe routes', () => {
  assert.equal(notificationCategory('ApplicationApproved'), 'Admission')
  assert.equal(notificationCategory('NewApplication'), 'Admission')
  assert.equal(notificationCategory('ModerationApprove'), 'Moderation')
  assert.equal(notificationCategory('RecruitmentRemoved'), 'Moderation')
  assert.equal(notificationCategory('CaptainTransferred'), 'Team')
  assert.equal(notificationLabel('ModerationReject'), 'Content rejected')

  assert.equal(
    notificationTargetUrl({
      id: '1', event: 'ApplicationApproved', message: '', isRead: false,
      target: { type: 'application', id: 'a1' }, createdAt: '',
    }),
    '/pages/applications/history',
  )
  assert.equal(
    notificationTargetUrl({
      id: '2', event: 'NewApplication', message: '', isRead: false,
      target: { type: 'application', id: 'a2' }, createdAt: '',
    }),
    '/pages/teams/index',
  )
  assert.equal(
    notificationTargetUrl({
      id: '3', event: 'ModerationApprove', message: '', isRead: false,
      target: { type: 'post', id: 'p1' }, createdAt: '',
    }),
    '/pages/community/post?id=p1&version=public',
  )
  assert.equal(
    notificationTargetUrl({
      id: '4', event: 'ModerationReject', message: '', isRead: false,
      target: { type: 'post', id: 'p2' }, createdAt: '',
    }),
    '/pages/community/post?id=p2&version=mine',
  )
  assert.equal(
    notificationTargetUrl({
      id: '5', event: 'ModerationRemove', message: '', isRead: false,
      target: { type: 'post', id: 'p3' }, createdAt: '',
    }),
    null,
  )
  assert.equal(
    notificationTargetUrl({
      id: '6', event: 'ModerationApproved', message: '', isRead: false,
      target: { type: 'team', id: 't1' }, createdAt: '',
    }),
    '/pages/teams/recruitment?id=t1',
  )
  assert.equal(
    notificationTargetUrl({
      id: '7', event: 'ModerationApprove', message: '', isRead: false,
      target: { type: 'competition', id: 's1' }, createdAt: '',
    }),
    '/pages/community/submissions',
  )
  assert.equal(
    notificationTargetUrl({
      id: '8', event: 'ModerationApprove', message: '', isRead: false,
      target: { type: 'comment', id: 'c1' }, createdAt: '',
    }),
    null,
  )
})

test('planner Day and Week views paginate /planner/day and /planner/week and adapt items', async () => {
  const { api, calls } = recordingClient({
    'GET /planner/day': ({ auth, query }) => {
      assert.equal(auth, 'required')
      assert.equal(query.date, '2026-11-25')
      return {
        items: [samplePlanDto, sampleTodoDto],
        total: 2,
        page: 1,
        pageSize: 100,
        startDate: '2026-11-25',
        endDate: '2026-11-25',
      }
    },
    'GET /planner/week': ({ auth, query }) => {
      assert.equal(auth, 'required')
      return query.page === 1
        ? {
            items: Array.from({ length: 100 }, (_, i) => ({ ...sampleTodoDto, id: `t-${i}` })),
            total: 101,
            page: 1,
            pageSize: 100,
            startDate: '2026-11-23',
            endDate: '2026-11-29',
          }
        : {
            items: [sampleCourseDto],
            total: 101,
            page: 2,
            pageSize: 100,
            startDate: '2026-11-23',
            endDate: '2026-11-29',
          }
    },
  })

  const day = await api.getPlannerView('2026-11-25', 'Day')
  assert.equal(day.ok, true)
  assert.equal(day.data.occurrences.length, 2)
  assert.equal(day.data.occurrences[0].type, 'TimedPlan')

  const week = await api.getPlannerView('2026-11-25', 'Week')
  assert.equal(week.ok, true)
  assert.equal(week.data.rangeStart, '2026-11-23')
  assert.equal(week.data.rangeEnd, '2026-11-29')
  assert.equal(week.data.occurrences.length, 101)
  assert.equal(week.data.occurrences[100].startWeek, 1)
  assert.equal(calls.length, 3)
})

test('planner creation sends exact backend schemas for Course, TimedPlan and Todo', async () => {
  const bodies = []
  const { api } = recordingClient({
    'POST /planner/items': ({ auth, body }) => {
      assert.equal(auth, 'required')
      bodies.push(body)
      if (body.kind === 'Course') {
        return {
          items: [sampleCourseDto],
          skipped: [{ date: '2026-09-14', reason: 'Duplicate course occurrence skipped.' }],
        }
      }
      if (body.kind === 'TimedPlan') return { items: [samplePlanDto], skipped: [] }
      return { items: [sampleTodoDto], skipped: [] }
    },
  })

  const course = await api.createCourse({
    name: ' Algorithms ',
    actualStartWeek: '2026-09-07',
    startWeek: 1,
    weekday: 1,
    startPeriod: 1,
    endPeriod: 2,
    room: ' Room B204 ',
    repeatCount: 2,
  })
  assert.equal(course.ok, true)
  assert.equal(course.data.createdCount, 1)
  assert.equal(course.data.skippedDuplicateCount, 1)
  assert.deepEqual(bodies[0], {
    kind: 'Course',
    title: 'Algorithms',
    startWeek: 1,
    weekday: 1,
    startPeriod: 1,
    endPeriod: 2,
    room: 'Room B204',
    occurrenceCount: 2,
  })

  const plan = await api.createPlannerItem({
    type: 'TimedPlan',
    title: 'Team sync',
    description: 'Should not be sent to TimedPlanCreate',
    assignedDate: '2026-11-25',
    startTime: '14:00',
    endTime: '15:00',
    repeatCount: 1,
  })
  assert.equal(plan.ok, true)
  assert.deepEqual(bodies[1], {
    kind: 'TimedPlan',
    title: 'Team sync',
    date: '2026-11-25',
    startTime: '14:00',
    endTime: '15:00',
    occurrenceCount: 1,
  })

  const todo = await api.createPlannerItem({
    type: 'Todo',
    title: 'Submit slides',
    description: 'Review metrics',
    assignedDate: '2026-11-25',
    deadline: '2026-11-26',
    repeatCount: 2,
  })
  assert.equal(todo.ok, true)
  assert.deepEqual(bodies[2], {
    kind: 'Todo',
    title: 'Submit slides',
    date: '2026-11-25',
    description: 'Review metrics',
    deadline: '2026-11-26T23:59:00Z',
    occurrenceCount: 2,
  })
})

test('planner single-occurrence update, toggle and delete send kind-scoped PATCH and DELETE', async () => {
  const patches = []
  const { api } = recordingClient({
    'GET /planner/items/todo-1': () => sampleTodoDto,
    'PATCH /planner/items/todo-1': ({ body }) => {
      patches.push(body)
      return { ...sampleTodoDto, ...body }
    },
    'GET /planner/items/course-1': () => sampleCourseDto,
    'PATCH /planner/items/course-1': ({ body }) => {
      patches.push(body)
      return { ...sampleCourseDto, ...body }
    },
    'DELETE /planner/items/todo-1': ({ auth }) => {
      assert.equal(auth, 'required')
    },
  })

  const updatedTodo = await api.updatePlannerOccurrence('todo-1', {
    title: 'Updated slides',
    actualDate: '2026-11-25',
    description: 'Final review',
    clearDeadline: true,
  })
  assert.equal(updatedTodo.ok, true)
  assert.deepEqual(patches[0], {
    title: 'Updated slides',
    date: '2026-11-25',
    description: 'Final review',
    deadline: null,
  })

  const toggled = await api.togglePlannerTodo('todo-1')
  assert.equal(toggled.ok, true)
  assert.equal(toggled.data.completed, true)
  assert.deepEqual(patches[1], { completed: true })

  const updatedCourse = await api.updatePlannerOccurrence('course-1', {
    title: 'Algorithms Lab',
    actualDate: '2026-09-07',
    startWeek: 2,
    weekday: 3,
    startPeriod: 1,
    endPeriod: 2,
    room: 'Lab 402',
  })
  assert.equal(updatedCourse.ok, true)
  assert.deepEqual(patches[2], {
    title: 'Algorithms Lab',
    room: 'Lab 402',
    startWeek: 2,
    weekday: 3,
    startPeriod: 1,
    endPeriod: 2,
  })

  const deleted = await api.deletePlannerOccurrence('todo-1')
  assert.equal(deleted.ok, true)
})

test('planner API maps backend errors into failed command envelopes and formats times cleanly', async () => {
  const { api } = recordingClient({
    'POST /planner/items': () => {
      throw new ApiError('Configure a valid SEMESTER_START_DATE and PERIOD_TIMES timetable.', {
        kind: 'http',
        status: 503,
        code: 'PLANNER_CONFIG_MISSING',
      })
    },
  })

  const result = await api.createCourse({
    name: 'Algorithms',
    actualStartWeek: '2026-09-07',
    startWeek: 1,
    weekday: 1,
    startPeriod: 1,
    endPeriod: 2,
    repeatCount: 1,
  })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'PLANNER_CONFIG_MISSING')

  assert.equal(normalizePlannerDeadline(''), null)
  assert.equal(normalizePlannerDeadline('2026-11-25'), '2026-11-25T23:59:00Z')
  assert.equal(formatPlannerTime('08:00:00'), '08:00')
  assert.equal(formatPlannerDeadline('2026-11-25T23:59:00'), '2026-11-25')
})
