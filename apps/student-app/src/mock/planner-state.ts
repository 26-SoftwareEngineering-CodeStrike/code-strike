import type {
  CourseCreationResult,
  CreateCourseInput,
  CreatePlannerItemInput,
  PlannerOccurrence,
  PlannerView,
  PlannerViewMode,
  SchoolPeriod,
  UpdateOccurrenceInput,
} from '@codestrike/contracts'
import { mockBusinessState, type MockResult } from './business-state'

interface OwnedOccurrence extends PlannerOccurrence { ownerStudentId: string }

export const exampleSchoolPeriods: SchoolPeriod[] = [
  { period: 1, startTime: '08:00', endTime: '08:45' },
  { period: 2, startTime: '08:55', endTime: '09:40' },
  { period: 3, startTime: '10:00', endTime: '10:45' },
  { period: 4, startTime: '10:55', endTime: '11:40' },
  { period: 5, startTime: '14:00', endTime: '14:45' },
  { period: 6, startTime: '14:55', endTime: '15:40' },
  { period: 7, startTime: '16:00', endTime: '16:45' },
  { period: 8, startTime: '16:55', endTime: '17:40' },
]

function initialOccurrences(): OwnedOccurrence[] {
  return [
    occurrence('planner-course-1', 'batch-course-demo', 'student-alex', 'Course', 'Design Research', '2026-10-27', '10:00', '11:40', 1, 4, { room: 'Example Room B204' }),
    occurrence('planner-plan-1', 'batch-plan-demo', 'student-alex', 'TimedPlan', 'Prototype critique', '2026-10-27', '10:30', '11:15', 1, 1, { description: 'Review the interaction flow.' }),
    occurrence('planner-todo-1', 'batch-todo-demo', 'student-alex', 'Todo', 'Refine interview notes', '2026-10-27', undefined, undefined, 1, 1, { description: 'No deadline; assigned date keeps it visible.' }),
    occurrence('planner-incomplete-1', 'batch-incomplete-demo', 'student-incomplete', 'Todo', 'Private planner is available', '2026-10-27', undefined, undefined, 1, 1, { description: 'Profile completeness is not required.' }),
  ]
}

function occurrence(id: string, batchId: string, ownerStudentId: string, type: PlannerOccurrence['type'], title: string, actualDate: string, startTime: string | undefined, endTime: string | undefined, occurrenceNumber: number, occurrenceCount: number, extra: Partial<PlannerOccurrence> = {}): OwnedOccurrence {
  return { id, batchId, ownerStudentId, type, title, actualDate, startTime, endTime, completed: false, occurrenceNumber, occurrenceCount, ...extra }
}

export class PlannerMockState {
  private rows = initialOccurrences()
  private sequence = 100

  reset(): void { this.rows = initialOccurrences(); this.sequence = 100 }
  listPeriods(): SchoolPeriod[] { return exampleSchoolPeriods.map((item) => ({ ...item })) }

  getView(selectedDate: string, mode: PlannerViewMode): MockResult<PlannerView> {
    const owner = this.owner()
    if (!owner.ok || !owner.studentId) return failure(owner.code, owner.message)
    if (!isDate(selectedDate)) return failure('INVALID_DATE', 'Choose a valid calendar date.')
    const rangeStart = mode === 'Week' ? addDays(selectedDate, -(weekday(selectedDate) - 1)) : selectedDate
    const rangeEnd = mode === 'Week' ? addDays(rangeStart, 6) : selectedDate
    const rows = this.rows.filter((item) => item.ownerStudentId === owner.studentId && item.actualDate >= rangeStart && item.actualDate <= rangeEnd).sort(compareOccurrence).map(publicOccurrence)
    return success('PLANNER_VIEW', 'Private planner loaded from in-memory Mock state.', { mode, selectedDate, rangeStart, rangeEnd, occurrences: rows })
  }

  createCourse(input: CreateCourseInput): MockResult<CourseCreationResult> {
    const owner = this.owner()
    if (!owner.ok || !owner.studentId) return failure(owner.code, owner.message)
    const validation = this.validateCourse(input)
    if (!validation.ok) return failure(validation.code, validation.message)
    const startPeriod = this.period(input.startPeriod)!
    const endPeriod = this.period(input.endPeriod)!
    const batchId = this.nextId('course-batch')
    const created: OwnedOccurrence[] = []
    let skippedDuplicateCount = 0
    for (let index = 0; index < input.repeatCount; index += 1) {
      const actualDate = addDays(input.actualStartWeek, input.weekday - 1 + index * 7)
      const duplicate = this.rows.some((item) => item.ownerStudentId === owner.studentId && item.type === 'Course' && normalize(item.title) === normalize(input.name) && item.actualDate === actualDate && item.startTime === startPeriod.startTime && item.endTime === endPeriod.endTime)
      if (duplicate) { skippedDuplicateCount += 1; continue }
      const row = occurrence(this.nextId('course'), batchId, owner.studentId, 'Course', input.name.trim(), actualDate, startPeriod.startTime, endPeriod.endTime, index + 1, input.repeatCount, { room: input.room?.trim() || undefined })
      this.rows.push(row); created.push(row)
    }
    return success('COURSE_CREATED', `Created ${created.length} occurrence(s); skipped ${skippedDuplicateCount} duplicate occurrence(s).`, { createdCount: created.length, skippedDuplicateCount, occurrences: created.map(publicOccurrence) })
  }

  createItem(input: CreatePlannerItemInput): MockResult<PlannerOccurrence[]> {
    const owner = this.owner()
    if (!owner.ok || !owner.studentId) return failure(owner.code, owner.message)
    if (!input.title.trim()) return failure('TITLE_REQUIRED', 'Title is required.')
    if (!isDate(input.assignedDate)) return failure('INVALID_DATE', 'Choose a valid assigned date.')
    if (!Number.isInteger(input.repeatCount) || input.repeatCount < 1 || input.repeatCount > 52) return failure('INVALID_REPEAT', 'Weekly repeat must be a finite count from 1 to 52.')
    if (input.type === 'TimedPlan' && (!isTime(input.startTime) || !isTime(input.endTime) || input.startTime! >= input.endTime!)) return failure('INVALID_TIME_RANGE', 'Timed plan end time must be after start time.')
    const batchId = this.nextId(input.type === 'TimedPlan' ? 'plan-batch' : 'todo-batch')
    const created: OwnedOccurrence[] = []
    for (let index = 0; index < input.repeatCount; index += 1) {
      const row = occurrence(this.nextId(input.type === 'TimedPlan' ? 'plan' : 'todo'), batchId, owner.studentId, input.type, input.title.trim(), addDays(input.assignedDate, index * 7), input.type === 'TimedPlan' ? input.startTime : undefined, input.type === 'TimedPlan' ? input.endTime : undefined, index + 1, input.repeatCount, { description: input.description?.trim() || undefined, deadline: input.type === 'Todo' && input.deadline ? input.deadline : undefined })
      this.rows.push(row); created.push(row)
    }
    return success('PLANNER_ITEM_CREATED', `${input.type === 'TimedPlan' ? 'Timed plan' : 'To-do'} saved with ${created.length} occurrence(s). Overlaps are allowed.`, created.map(publicOccurrence))
  }

  getOccurrence(id: string): MockResult<PlannerOccurrence> {
    const owned = this.ownedOccurrence(id)
    return owned.ok && owned.item ? success('OCCURRENCE', 'Occurrence loaded.', publicOccurrence(owned.item)) : failure(owned.code, owned.message)
  }

  updateOccurrence(id: string, input: UpdateOccurrenceInput): MockResult<PlannerOccurrence> {
    const owned = this.ownedOccurrence(id)
    if (!owned.ok || !owned.item) return failure(owned.code, owned.message)
    if (!input.title.trim() || !isDate(input.actualDate)) return failure('INVALID_OCCURRENCE', 'Title and actual date are required.')
    if (owned.item.type !== 'Todo' && (!isTime(input.startTime) || !isTime(input.endTime) || input.startTime! >= input.endTime!)) return failure('INVALID_TIME_RANGE', 'End time must be after start time.')
    Object.assign(owned.item, { title: input.title.trim(), actualDate: input.actualDate, startTime: owned.item.type === 'Todo' ? undefined : input.startTime, endTime: owned.item.type === 'Todo' ? undefined : input.endTime, room: input.room?.trim() || undefined, description: input.description?.trim() || undefined, deadline: owned.item.type === 'Todo' ? input.deadline || undefined : undefined })
    return success('OCCURRENCE_UPDATED', 'Only this occurrence was updated; the rest of the series is unchanged.', publicOccurrence(owned.item))
  }

  deleteOccurrence(id: string): MockResult {
    const owned = this.ownedOccurrence(id)
    if (!owned.ok || !owned.item) return failure(owned.code, owned.message)
    this.rows = this.rows.filter((item) => item.id !== owned.item!.id)
    return success('OCCURRENCE_DELETED', 'Only this occurrence was deleted; the rest of the series was retained.')
  }

  toggleTodo(id: string): MockResult<PlannerOccurrence> {
    const owned = this.ownedOccurrence(id)
    if (!owned.ok || !owned.item) return failure(owned.code, owned.message)
    if (owned.item.type !== 'Todo') return failure('NOT_TODO', 'Completion is available only for a to-do occurrence.')
    owned.item.completed = !owned.item.completed
    return success('TODO_COMPLETION_UPDATED', owned.item.completed ? 'This to-do occurrence is complete.' : 'This to-do occurrence is not complete.', publicOccurrence(owned.item))
  }

  private owner(): { ok: boolean; code: string; message: string; studentId?: string } {
    const actor = mockBusinessState.getActor()
    if (!actor.studentId || actor.role === 'Visitor' || actor.role === 'Admin') return { ok: false, code: 'PLANNER_OWNER_REQUIRED', message: 'A signed-in student can access only their own private planner.' }
    return { ok: true, code: 'OWNER', message: 'Owner resolved.', studentId: actor.studentId }
  }
  private ownedOccurrence(id: string): { ok: boolean; code: string; message: string; item?: OwnedOccurrence } {
    const owner = this.owner()
    if (!owner.ok || !owner.studentId) return owner
    const item = this.rows.find((row) => row.id === id && row.ownerStudentId === owner.studentId)
    return item ? { ok: true, code: 'OWNED', message: 'Owned occurrence.', item } : { ok: false, code: 'OCCURRENCE_NOT_FOUND', message: 'Occurrence is unavailable to the selected student.' }
  }
  private validateCourse(input: CreateCourseInput): MockResult {
    if (!input.name.trim()) return failure('COURSE_NAME_REQUIRED', 'Course name is required.')
    if (!isDate(input.actualStartWeek) || input.weekday < 1 || input.weekday > 7) return failure('INVALID_START_WEEK', 'Choose a valid actual start week and weekday.')
    if (!this.period(input.startPeriod) || !this.period(input.endPeriod) || input.startPeriod > input.endPeriod) return failure('INVALID_PERIOD_RANGE', 'End period must not be before start period.')
    if (!Number.isInteger(input.repeatCount) || input.repeatCount < 1 || input.repeatCount > 52) return failure('INVALID_REPEAT', 'Weekly repeat must be a finite count from 1 to 52.')
    return success('VALID', 'Course input is valid.')
  }
  private period(value: number): SchoolPeriod | undefined { return exampleSchoolPeriods.find((item) => item.period === value) }
  private nextId(prefix: string): string { this.sequence += 1; return `${prefix}-${this.sequence}` }
}

function publicOccurrence(item: OwnedOccurrence): PlannerOccurrence { const { ownerStudentId: _owner, ...result } = item; return { ...result } }
function compareOccurrence(left: OwnedOccurrence, right: OwnedOccurrence): number { return left.actualDate.localeCompare(right.actualDate) || (left.startTime || '99:99').localeCompare(right.startTime || '99:99') || left.id.localeCompare(right.id) }
function normalize(value: string): string { return value.trim().toLocaleLowerCase() }
function isDate(value: string | undefined): value is string { return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && formatDate(parseDate(value)) === value) }
function isTime(value: string | undefined): value is string { return Boolean(value && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) }
function parseDate(value: string): Date { const [year, month, day] = value.split('-').map(Number); return new Date(Date.UTC(year, month - 1, day)) }
function formatDate(value: Date): string { return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}` }
export function addCalendarDays(value: string, days: number): string { const date = parseDate(value); date.setUTCDate(date.getUTCDate() + days); return formatDate(date) }
function addDays(value: string, days: number): string { return addCalendarDays(value, days) }
function weekday(value: string): number { const day = parseDate(value).getUTCDay(); return day === 0 ? 7 : day }
function success<T = undefined>(code: string, message: string, data?: T): MockResult<T> { return { ok: true, code, message, data } }
function failure<T = undefined>(code: string, message: string): MockResult<T> { return { ok: false, code, message } }

export const plannerMockState = new PlannerMockState()
