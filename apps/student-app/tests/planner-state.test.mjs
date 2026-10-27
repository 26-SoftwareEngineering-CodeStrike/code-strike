import assert from 'node:assert/strict'
import test from 'node:test'
import { mockBusinessState } from '../src/mock/business-state.ts'
import { addCalendarDays, PlannerMockState } from '../src/mock/planner-state.ts'

function setup(actorId = 'student-alex') {
  mockBusinessState.reset()
  assert.equal(mockBusinessState.selectActor(actorId).ok, true)
  return new PlannerMockState()
}

const course = (overrides = {}) => ({
  name: 'Systems Studio', actualStartWeek: '2026-10-26', weekday: 2,
  startPeriod: 1, endPeriod: 2, room: 'Example Room A101', repeatCount: 4,
  ...overrides,
})

test('incomplete signed-in student can use the private planner', () => {
  const state = setup('student-incomplete')
  assert.equal(state.getView('2026-10-27', 'Day').ok, true)
  assert.equal(state.createItem({ type: 'Todo', title: 'Complete profile later', assignedDate: '2026-10-28', repeatCount: 1 }).ok, true)
})

test('visitor cannot read a student private planner', () => {
  const state = setup('visitor')
  assert.equal(state.getView('2026-10-27', 'Day').code, 'PLANNER_OWNER_REQUIRED')
})

test('different students have isolated planner data', () => {
  const state = setup('student-alex')
  state.createItem({ type: 'Todo', title: 'Alex private item', assignedDate: '2026-10-28', repeatCount: 1 })
  mockBusinessState.selectActor('student-incomplete')
  const other = state.getView('2026-10-28', 'Day')
  assert.equal(other.ok, true)
  assert.equal(other.data.occurrences.some((item) => item.title === 'Alex private item'), false)
})

test('Day and Week views expose the same stable occurrence', () => {
  const state = setup()
  const day = state.getView('2026-10-27', 'Day').data.occurrences
  const week = state.getView('2026-10-27', 'Week').data.occurrences
  assert.ok(day.length > 0)
  for (const item of day) assert.ok(week.some((weekly) => weekly.id === item.id))
})

test('actual start week includes the first finite weekly occurrence and then stops', () => {
  const state = setup()
  const result = state.createCourse(course())
  assert.equal(result.ok, true)
  assert.deepEqual(result.data.occurrences.map((item) => item.actualDate), ['2026-10-27', '2026-11-03', '2026-11-10', '2026-11-17'])
  assert.equal(state.getView('2026-11-24', 'Day').data.occurrences.some((item) => item.title === 'Systems Studio'), false)
})

test('course duplicate criterion uses name, actual date, start and end time and skips only duplicate instances', () => {
  const state = setup()
  assert.equal(state.createCourse(course()).data.createdCount, 4)
  const overlap = state.createCourse(course({ actualStartWeek: '2026-11-02', repeatCount: 4 }))
  assert.equal(overlap.data.skippedDuplicateCount, 3)
  assert.equal(overlap.data.createdCount, 1)
  assert.equal(overlap.data.occurrences[0].actualDate, '2026-11-24')
})

test('different-name overlapping course is retained', () => {
  const state = setup()
  state.createCourse(course({ repeatCount: 1 }))
  const second = state.createCourse(course({ name: 'Visual Computing', repeatCount: 1 }))
  assert.equal(second.data.createdCount, 1)
  assert.equal(state.getView('2026-10-27', 'Day').data.occurrences.filter((item) => item.startTime === '08:00').length, 2)
})

test('timed plan may overlap a course', () => {
  const state = setup()
  state.createCourse(course({ repeatCount: 1 }))
  const result = state.createItem({ type: 'TimedPlan', title: 'Overlap intentionally', assignedDate: '2026-10-27', startTime: '08:15', endTime: '09:00', repeatCount: 1 })
  assert.equal(result.ok, true)
  assert.ok(state.getView('2026-10-27', 'Day').data.occurrences.some((item) => item.title === 'Overlap intentionally'))
})

test('to-do without a deadline remains visible on its assigned date', () => {
  const state = setup()
  const result = state.createItem({ type: 'Todo', title: 'No deadline', assignedDate: '2026-11-01', repeatCount: 1 })
  assert.equal(result.data[0].deadline, undefined)
  assert.ok(state.getView('2026-11-01', 'Day').data.occurrences.some((item) => item.id === result.data[0].id))
})

test('editing one course occurrence keeps its stable ID and leaves adjacent weeks unchanged', () => {
  const state = setup()
  const created = state.createCourse(course({ repeatCount: 4 })).data.occurrences
  const third = created[2]
  const result = state.updateOccurrence(third.id, { title: 'Systems Studio - shifted', actualDate: third.actualDate, startTime: '14:00', endTime: '15:40', room: 'Example Room C303' })
  assert.equal(result.data.id, third.id)
  assert.equal(state.getOccurrence(created[1].id).data.title, 'Systems Studio')
  assert.equal(state.getOccurrence(created[3].id).data.startTime, '08:00')
})

test('deleting one course occurrence retains the rest of its series', () => {
  const state = setup()
  const created = state.createCourse(course({ repeatCount: 4 })).data.occurrences
  assert.equal(state.deleteOccurrence(created[2].id).ok, true)
  assert.equal(state.getOccurrence(created[2].id).code, 'OCCURRENCE_NOT_FOUND')
  assert.equal(state.getOccurrence(created[1].id).ok, true)
  assert.equal(state.getOccurrence(created[3].id).ok, true)
})

test('completing one repeated to-do leaves the other occurrence unchanged', () => {
  const state = setup()
  const created = state.createItem({ type: 'Todo', title: 'Weekly check', assignedDate: '2026-10-27', repeatCount: 2 }).data
  assert.equal(state.toggleTodo(created[0].id).data.completed, true)
  assert.equal(state.getOccurrence(created[1].id).data.completed, false)
})

test('calendar date arithmetic remains stable across month, year and leap-day boundaries', () => {
  assert.equal(addCalendarDays('2026-10-31', 1), '2026-11-01')
  assert.equal(addCalendarDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addCalendarDays('2028-02-28', 1), '2028-02-29')
})

test('Mock create, read, update, complete and delete operations stay consistent', () => {
  const state = setup()
  const created = state.createItem({ type: 'Todo', title: 'Lifecycle', assignedDate: '2026-12-01', repeatCount: 1 }).data[0]
  assert.equal(state.getOccurrence(created.id).data.title, 'Lifecycle')
  assert.equal(state.updateOccurrence(created.id, { title: 'Lifecycle updated', actualDate: '2026-12-02' }).data.title, 'Lifecycle updated')
  assert.equal(state.toggleTodo(created.id).data.completed, true)
  assert.ok(state.getView('2026-12-02', 'Day').data.occurrences.some((item) => item.id === created.id))
  assert.equal(state.deleteOccurrence(created.id).ok, true)
  assert.equal(state.getOccurrence(created.id).code, 'OCCURRENCE_NOT_FOUND')
})
