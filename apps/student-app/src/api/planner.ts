import type {
  ApiTransport,
  CourseCreationResult,
  CreateCourseInput,
  CreatePlannerItemInput,
  PlannerCourseCreateRequest,
  PlannerCreateResultDto,
  PlannerItemDto,
  PlannerItemPageDto,
  PlannerItemPatchRequest,
  PlannerOccurrence,
  PlannerTimedPlanCreateRequest,
  PlannerTodoCreateRequest,
  PlannerView,
  PlannerViewMode,
  SchoolPeriod,
  UpdateOccurrenceInput,
} from '@codestrike/contracts'
import { toPlannerOccurrence } from '@codestrike/contracts'

const DEFAULT_PERIOD_COUNT = 12

export function normalizePlannerDeadline(value?: string): string | null {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T23:59:00Z`
  return trimmed
}

export function formatPlannerTime(value?: string): string {
  if (!value) return ''
  return /^\d{2}:\d{2}:\d{2}$/.test(value) ? value.slice(0, 5) : value
}

export function formatPlannerDeadline(value?: string): string {
  if (!value) return ''
  return value.length >= 10 ? value.slice(0, 10) : value
}

export function todayLocalIso(now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function defaultApiSchoolPeriods(): SchoolPeriod[] {
  return Array.from({ length: DEFAULT_PERIOD_COUNT }, (_, index) => ({
    period: index + 1,
    startTime: '',
    endTime: '',
  }))
}

export function buildCourseCreatePayload(input: CreateCourseInput): PlannerCourseCreateRequest {
  const title = input.name.trim()
  if (!title) throw new Error('Course name is required.')
  const startWeek = input.startWeek ?? 1
  if (!Number.isInteger(startWeek) || startWeek < 1) {
    throw new Error('Start week must be a whole number of at least 1.')
  }
  if (!Number.isInteger(input.weekday) || input.weekday < 1 || input.weekday > 7) {
    throw new Error('Choose a weekday from Monday to Sunday.')
  }
  if (!Number.isInteger(input.startPeriod) || !Number.isInteger(input.endPeriod) || input.startPeriod > input.endPeriod) {
    throw new Error('End period must not precede start period.')
  }
  if (!Number.isInteger(input.repeatCount) || input.repeatCount < 1) {
    throw new Error('Weekly repeat count must be at least 1.')
  }
  return {
    kind: 'Course',
    title,
    startWeek,
    weekday: input.weekday,
    startPeriod: input.startPeriod,
    endPeriod: input.endPeriod,
    room: input.room?.trim() || null,
    occurrenceCount: input.repeatCount,
  }
}

export function buildPlannerItemCreatePayload(
  input: CreatePlannerItemInput,
): PlannerTimedPlanCreateRequest | PlannerTodoCreateRequest {
  const title = input.title.trim()
  if (!title) throw new Error('Title is required.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.assignedDate)) {
    throw new Error('Choose a valid assigned date.')
  }
  if (!Number.isInteger(input.repeatCount) || input.repeatCount < 1) {
    throw new Error('Repeat count must be at least 1.')
  }
  if (input.type === 'TimedPlan') {
    const startTime = input.startTime?.trim() ?? ''
    const endTime = input.endTime?.trim() ?? ''
    if (!startTime || !endTime) throw new Error('Start time and end time are required.')
    if (startTime >= endTime) throw new Error('End time must follow start time.')
    return {
      kind: 'TimedPlan',
      title,
      date: input.assignedDate,
      startTime,
      endTime,
      occurrenceCount: input.repeatCount,
    }
  }
  return {
    kind: 'Todo',
    title,
    date: input.assignedDate,
    description: input.description?.trim() || null,
    deadline: normalizePlannerDeadline(input.deadline),
    occurrenceCount: input.repeatCount,
  }
}

export function buildPlannerPatchPayload(
  kind: PlannerItemDto['kind'],
  input: UpdateOccurrenceInput,
): PlannerItemPatchRequest {
  const title = input.title.trim()
  if (!title) throw new Error('Title is required.')
  if (kind === 'Course') {
    const patch: PlannerItemPatchRequest = {
      title,
      room: input.room?.trim() || null,
    }
    if (input.startWeek !== undefined) patch.startWeek = input.startWeek
    if (input.weekday !== undefined) patch.weekday = input.weekday
    if (input.startPeriod !== undefined) patch.startPeriod = input.startPeriod
    if (input.endPeriod !== undefined) patch.endPeriod = input.endPeriod
    return patch
  }
  if (kind === 'TimedPlan') {
    const startTime = input.startTime?.trim() ?? ''
    const endTime = input.endTime?.trim() ?? ''
    if (!startTime || !endTime) throw new Error('Start time and end time are required.')
    if (startTime >= endTime) throw new Error('End time must follow start time.')
    return {
      title,
      date: input.actualDate,
      startTime,
      endTime,
    }
  }
  return {
    title,
    date: input.actualDate,
    description: input.description?.trim() || null,
    deadline: input.clearDeadline ? null : normalizePlannerDeadline(input.deadline),
  }
}

export function createPlannerApi(transport: ApiTransport) {
  const required = { auth: 'required' } as const
  const id = encodeURIComponent

  return {
    async view(selectedDate: string, mode: PlannerViewMode): Promise<PlannerView> {
      const path = mode === 'Week' ? '/planner/week' : '/planner/day'
      const pageSize = 100
      const rows: PlannerItemDto[] = []
      let rangeStart = selectedDate
      let rangeEnd = selectedDate
      for (let page = 1; page <= 50; page += 1) {
        const result = await transport.request<PlannerItemPageDto>({
          path,
          query: { date: selectedDate, page, pageSize },
          ...required,
        })
        if (page === 1) {
          rangeStart = result.startDate
          rangeEnd = result.endDate
        }
        rows.push(...result.items)
        if (rows.length >= result.total || result.items.length < pageSize) break
      }
      return {
        mode,
        selectedDate,
        rangeStart,
        rangeEnd,
        occurrences: rows.map((row) => toPlannerOccurrence(row)),
      }
    },
    async createCourse(input: CreateCourseInput): Promise<CourseCreationResult> {
      const body = buildCourseCreatePayload(input)
      const result = await transport.request<PlannerCreateResultDto>({
        path: '/planner/items',
        method: 'POST',
        body,
        ...required,
      })
      const total = result.items.length
      return {
        createdCount: total,
        skippedDuplicateCount: result.skipped.length,
        occurrences: result.items.map((row, index) =>
          toPlannerOccurrence(row, { occurrenceNumber: index + 1, occurrenceCount: Math.max(total, 1) }),
        ),
      }
    },
    async createItem(input: CreatePlannerItemInput): Promise<PlannerOccurrence[]> {
      const body = buildPlannerItemCreatePayload(input)
      const result = await transport.request<PlannerCreateResultDto>({
        path: '/planner/items',
        method: 'POST',
        body,
        ...required,
      })
      const total = result.items.length
      return result.items.map((row, index) =>
        toPlannerOccurrence(row, { occurrenceNumber: index + 1, occurrenceCount: Math.max(total, 1) }),
      )
    },
    async getOccurrence(itemId: string): Promise<PlannerOccurrence> {
      const row = await transport.request<PlannerItemDto>({
        path: `/planner/items/${id(itemId)}`,
        ...required,
      })
      return toPlannerOccurrence(row)
    },
    async updateOccurrence(itemId: string, input: UpdateOccurrenceInput): Promise<PlannerOccurrence> {
      const current = await transport.request<PlannerItemDto>({
        path: `/planner/items/${id(itemId)}`,
        ...required,
      })
      const body = buildPlannerPatchPayload(current.kind, input)
      const updated = await transport.request<PlannerItemDto>({
        path: `/planner/items/${id(itemId)}`,
        method: 'PATCH',
        body,
        ...required,
      })
      return toPlannerOccurrence(updated)
    },
    async deleteOccurrence(itemId: string): Promise<void> {
      await transport.request<void>({
        path: `/planner/items/${id(itemId)}`,
        method: 'DELETE',
        ...required,
      })
    },
    async toggleTodo(itemId: string, nextCompleted?: boolean): Promise<PlannerOccurrence> {
      const completed =
        nextCompleted ??
        !(await transport.request<PlannerItemDto>({
          path: `/planner/items/${id(itemId)}`,
          ...required,
        })).completed
      const body: PlannerItemPatchRequest = { completed }
      const updated = await transport.request<PlannerItemDto>({
        path: `/planner/items/${id(itemId)}`,
        method: 'PATCH',
        body,
        ...required,
      })
      return toPlannerOccurrence(updated)
    },
  }
}

export type PlannerApi = ReturnType<typeof createPlannerApi>
