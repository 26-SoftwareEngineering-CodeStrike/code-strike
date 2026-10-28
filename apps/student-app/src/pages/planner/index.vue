<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import type { PlannerOccurrence, PlannerViewMode, PrototypeActor } from '@codestrike/contracts'
import { createStudentApiClient } from '../../api/client'
import CsBottomNav from '../../components/CsBottomNav.vue'
import CsHeader from '../../components/CsHeader.vue'
import PersonaSwitcher from '../../components/PersonaSwitcher.vue'
import StatePanel from '../../components/StatePanel.vue'

const api = createStudentApiClient()
const actors = ref<PrototypeActor[]>([])
const actorId = ref('visitor')
const selectedDate = ref('2026-10-27')
const mode = ref<PlannerViewMode>('Day')
const items = ref<PlannerOccurrence[]>([])
const loading = ref(true)
const error = ref('')
const feedback = ref('')
const labOpen = ref(false)
const rangeLabel = computed(() => mode.value === 'Day' ? selectedDate.value : `Week containing ${selectedDate.value}`)

onShow(initialize)
async function initialize() { const [available, current] = await Promise.all([api.listPrototypeActors(), api.getPrototypeActor()]); actors.value = available.filter((actor) => ['visitor', 'student-alex', 'student-incomplete', 'captain-alpha', 'alpha-successor', 'admin-reviewer'].includes(actor.id)); actorId.value = current.id; await load() }
async function selectActor(id: string) { const result = await api.selectPrototypeActor(id); if (result.ok) actorId.value = id; feedback.value = ''; await load() }
async function load() { loading.value = true; error.value = ''; const result = await api.getPlannerView(selectedDate.value, mode.value); items.value = result.ok && result.data ? result.data.occurrences : []; if (!result.ok) error.value = result.message; loading.value = false }
function chooseMode(value: PlannerViewMode) { mode.value = value; load() }
function chooseDate(event: { detail: { value: string } }) { selectedDate.value = event.detail.value; load() }
function shift(days: number) { selectedDate.value = addDays(selectedDate.value, days); load() }
function addDays(value: string, days: number) { const [year, month, day] = value.split('-').map(Number); const date = new Date(Date.UTC(year, month - 1, day)); date.setUTCDate(date.getUTCDate() + days); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}` }
function openCourse() { uni.navigateTo({ url: `/pages/planner/course?date=${selectedDate.value}` }) }
function openItem(type: 'TimedPlan' | 'Todo') { uni.navigateTo({ url: `/pages/planner/item?date=${selectedDate.value}&type=${type}` }) }
function openOccurrence(id: string) { uni.navigateTo({ url: `/pages/planner/occurrence?id=${id}` }) }
async function toggle(item: PlannerOccurrence) { const result = await api.togglePlannerTodo(item.id); feedback.value = result.message; await load() }
function typeLabel(type: PlannerOccurrence['type']) { return type === 'TimedPlan' ? 'Plan' : type === 'Todo' ? 'To-do' : 'Course' }
</script>

<template>
  <view class="page-shell">
    <CsHeader demo eyebrow="Private schedule" title="Planner" @demo="labOpen = true" />
    <view class="content">
      <view class="planner-head"><view><text class="planner-head__title">Your day, at a glance</text><text class="planner-head__copy">Courses, plans and to-dos stay private to your account.</text></view><text class="privacy-mark">Private</text></view>
      <view class="toolbar"><view class="mode"><button :class="{ active: mode === 'Day' }" @click="chooseMode('Day')">Day</button><button :class="{ active: mode === 'Week' }" @click="chooseMode('Week')">Week</button></view><view class="date-row"><button aria-label="Previous date" @click="shift(mode === 'Day' ? -1 : -7)">‹</button><picker mode="date" :value="selectedDate" @change="chooseDate"><view class="date">{{ rangeLabel }}</view></picker><button aria-label="Next date" @click="shift(mode === 'Day' ? 1 : 7)">›</button></view></view>

      <StatePanel v-if="loading" title="Loading planner" message="Getting your schedule." />
      <StatePanel v-else-if="error" title="Planner access denied" :message="error" />
      <StatePanel v-else-if="items.length === 0" title="Nothing scheduled" message="Add a course, timed plan or to-do for this date." />
      <view v-else class="timeline"><view v-for="item in items" :key="item.id" class="entry" :class="item.type.toLowerCase()" @click="openOccurrence(item.id)"><text class="entry__time">{{ item.startTime || (item.deadline ? `Due ${item.deadline}` : 'Anytime') }}</text><view class="entry__body"><view class="entry__rail"><text class="entry__type">{{ typeLabel(item.type) }}</text><text class="series">{{ item.occurrenceNumber }}/{{ item.occurrenceCount }}</text></view><text class="entry__title" :class="{ done: item.completed }">{{ item.title }}</text><text class="entry__meta">{{ item.actualDate }}<template v-if="item.startTime"> · until {{ item.endTime }}</template><template v-if="item.room"> · {{ item.room }}</template></text></view><button v-if="item.type === 'Todo'" class="complete" @click.stop="toggle(item)">{{ item.completed ? 'Undo' : 'Complete' }}</button></view></view>

      <view class="add-grid"><button class="course" @click="openCourse"><text>+</text> Course</button><button class="plan" @click="openItem('TimedPlan')"><text>+</text> Timed plan</button><button class="todo" @click="openItem('Todo')"><text>+</text> To-do</button></view>
      <text v-if="feedback" class="feedback">{{ feedback }}</text>
    </view>
    <PersonaSwitcher :actors="actors" :selected-id="actorId" overlay :open="labOpen" @select="selectActor" @close="labOpen = false" />
    <CsBottomNav active="Planner" />
  </view>
</template>

<style scoped>
.content { max-width: 900px; margin: 0 auto; padding: 20px 16px; padding-bottom: calc(128px + constant(safe-area-inset-bottom)); padding-bottom: calc(128px + env(safe-area-inset-bottom)); }.planner-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }.planner-head__title,.planner-head__copy,.entry__time,.entry__type,.entry__title,.entry__meta,.feedback { display: block; }.planner-head__title { color: #14213d; font-size: 26px; font-weight: 780; line-height: 1.2; }.planner-head__copy { margin-top: 6px; color: #667085; font-size: 15px; line-height: 1.45; }.privacy-mark { flex: 0 0 auto; padding: 5px 8px; color: #126b57; background: #edf8f4; border: 1px solid #cbe9df; border-radius: 7px; font-size: 12px; font-weight: 700; }
.toolbar { margin-top: 18px; padding: 6px; background: #fff; border: 1px solid #dfe4ea; border-radius: 16px; }.mode { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }.mode button,.date-row button { min-height: 44px; margin: 0; color: #667085; background: transparent; border-radius: 10px; font-size: 15px; font-weight: 700; }.mode button.active { color: #14213d; background: #eaf1ff; box-shadow: inset 0 -2px #2563eb; }.date-row { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; gap: 5px; margin-top: 4px; padding-top: 5px; border-top: 1px solid #edf0f3; }.date { min-height: 44px; padding: 11px 6px; text-align: center; color: #344054; background: #f7f9fb; border-radius: 10px; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
.timeline { display: grid; gap: 10px; margin-top: 14px; }.entry { position: relative; display: grid; grid-template-columns: 58px minmax(0,1fr) auto; align-items: center; gap: 12px; width: 100%; min-height: 0; margin: 0; padding: 15px 16px 15px 14px; text-align: left; background: #fff; border: 1px solid #dfe4ea; border-left: 5px solid #2563eb; border-radius: 14px; }.entry.timedplan { border-left-color: #d46a58; }.entry.todo { border-left-color: #16856b; }.entry__time { align-self: start; padding-top: 20px; color: #344054; font-size: 13px; font-weight: 750; font-variant-numeric: tabular-nums; }.entry__body { min-width: 0; }.entry__rail { display: flex; align-items: center; justify-content: space-between; gap: 10px; }.entry__type { color: #667085; font-size: 12px; font-weight: 700; }.entry__title { margin-top: 4px; color: #14213d; font-size: 17px; font-weight: 750; line-height: 1.35; }.entry__title.done { color: #667085; text-decoration: line-through; }.entry__meta { margin-top: 3px; color: #667085; font-size: 13px; line-height: 1.4; }.series { color: #8993a4; font-size: 12px; font-weight: 700; }.complete { min-height: 44px; margin: 0; padding: 0 11px; color: #126b57; background: #edf8f4; border-radius: 10px; font-size: 12px; font-weight: 700; }
.add-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-top: 14px; }.add-grid button { min-height: 48px; margin: 0; padding: 0 5px; color: #1e56b3; background: #eef4ff; border-radius: 11px; font-size: 13px; font-weight: 700; }.add-grid button text { font-size: 18px; }.add-grid .todo { color: #126b57; background: #edf8f4; }.add-grid .plan { color: #9a4d40; background: #fff1ef; }
.feedback { margin-top: 8px; padding: 9px 12px; color: #667085; background: #f7f9fb; border-radius: 10px; font-size: 13px; line-height: 1.45; }
@media (min-width: 680px) { .content { padding: 28px 40px calc(138px + env(safe-area-inset-bottom)); } }
@media (max-width: 380px) { .entry { grid-template-columns: 50px minmax(0,1fr); gap: 9px; }.complete { grid-column: 2; justify-self: start; }.entry__time { font-size: 12px; }.add-grid { grid-template-columns: 1fr; }.planner-head { display: block; }.privacy-mark { display: inline-block; margin-top: 10px; } }
</style>
