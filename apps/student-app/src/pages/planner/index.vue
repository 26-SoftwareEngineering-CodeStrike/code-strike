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
const rangeLabel = computed(() => mode.value === 'Day' ? selectedDate.value : `Week containing ${selectedDate.value}`)

onShow(initialize)
async function initialize() {
  const [available, current] = await Promise.all([api.listPrototypeActors(), api.getPrototypeActor()])
  actors.value = available.filter((actor) => ['visitor', 'student-alex', 'student-incomplete', 'captain-alpha', 'alpha-successor', 'admin-reviewer'].includes(actor.id))
  actorId.value = current.id
  await load()
}
async function selectActor(id: string) { const result = await api.selectPrototypeActor(id); if (result.ok) actorId.value = id; feedback.value = result.message; await load() }
async function load() { loading.value = true; error.value = ''; const result = await api.getPlannerView(selectedDate.value, mode.value); items.value = result.ok && result.data ? result.data.occurrences : []; if (!result.ok) error.value = result.message; loading.value = false }
function chooseMode(value: PlannerViewMode) { mode.value = value; load() }
function chooseDate(event: { detail: { value: string } }) { selectedDate.value = event.detail.value; load() }
function shift(days: number) { selectedDate.value = addDays(selectedDate.value, days); load() }
function addDays(value: string, days: number) { const [year, month, day] = value.split('-').map(Number); const date = new Date(Date.UTC(year, month - 1, day)); date.setUTCDate(date.getUTCDate() + days); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}` }
function openCourse() { uni.navigateTo({ url: `/pages/planner/course?date=${selectedDate.value}` }) }
function openItem(type: 'TimedPlan' | 'Todo') { uni.navigateTo({ url: `/pages/planner/item?date=${selectedDate.value}&type=${type}` }) }
function openOccurrence(id: string) { uni.navigateTo({ url: `/pages/planner/occurrence?id=${id}` }) }
async function toggle(item: PlannerOccurrence) { const result = await api.togglePlannerTodo(item.id); feedback.value = result.message; await load() }
</script>

<template>
  <view class="page-shell"><CsHeader eyebrow="UI-16 / OWNER PRIVATE" title="Personal Planner" />
    <view class="content"><PersonaSwitcher :actors="actors" :selected-id="actorId" @select="selectActor" />
      <text v-if="feedback" class="feedback">{{ feedback }}</text>
      <view class="privacy"><text class="privacy__title">Private, manual and Mock-only</text><text>Profile completion is not required. No competition task, notification or reminder is generated automatically.</text></view>
      <view class="toolbar"><view class="mode"><button :class="{ active: mode === 'Day' }" @click="chooseMode('Day')">Day</button><button :class="{ active: mode === 'Week' }" @click="chooseMode('Week')">Week</button></view><view class="date-row"><button aria-label="Previous date" @click="shift(mode === 'Day' ? -1 : -7)">&lt;</button><picker mode="date" :value="selectedDate" @change="chooseDate"><view class="date">{{ rangeLabel }}</view></picker><button aria-label="Next date" @click="shift(mode === 'Day' ? 1 : 7)">&gt;</button></view></view>
      <StatePanel v-if="loading" title="Loading private planner" message="Reading the selected owner's in-memory occurrences." />
      <StatePanel v-else-if="error" title="Planner access denied" :message="error" />
      <StatePanel v-else-if="items.length === 0" title="No items on this date" message="Courses, timed plans and to-dos can be added manually." />
      <view v-else class="timeline"><view v-for="item in items" :key="item.id" class="entry" :class="item.type.toLowerCase()" @click="openOccurrence(item.id)"><view><text class="entry__type">{{ item.type }} / {{ item.actualDate }}</text><text class="entry__title" :class="{ done: item.completed }">{{ item.title }}</text><text class="entry__meta">{{ item.startTime ? `${item.startTime}-${item.endTime}` : item.deadline ? `Due ${item.deadline}` : 'No deadline' }}<template v-if="item.room"> / {{ item.room }}</template></text></view><text class="series">{{ item.occurrenceNumber }}/{{ item.occurrenceCount }}</text><button v-if="item.type === 'Todo'" class="complete" @click.stop="toggle(item)">{{ item.completed ? 'Undo' : 'Complete' }}</button></view></view>
      <view class="add-grid"><button class="course" @click="openCourse">+ Course</button><button class="plan" @click="openItem('TimedPlan')">+ Timed Plan</button><button class="todo" @click="openItem('Todo')">+ To-do</button></view>
      <text class="limit">State is private to the selected Mock student and resets on a full reload.</text>
    </view><CsBottomNav active="Planner" />
  </view>
</template>

<style scoped>
.content{max-width:900px;margin:auto;padding:28rpx 26rpx 220rpx}.feedback,.privacy{display:block;margin-top:18rpx;padding:20rpx;border-radius:18rpx;font-size:21rpx;line-height:1.5}.feedback{color:#24527f;background:#e3f2ff}.privacy{color:#185a4c;background:#dff8f1}.privacy__title{display:block;font-size:24rpx;font-weight:900}.toolbar{margin-top:20rpx;padding:18rpx;background:#fff;border:1rpx solid #dce4ed;border-radius:24rpx}.mode{display:grid;grid-template-columns:1fr 1fr;gap:8rpx}.mode button,.date-row button{margin:0;color:#65748a;background:#edf1f5;border-radius:14rpx;font-weight:850}.mode button.active{color:#fff;background:#245ac8}.date-row{display:grid;grid-template-columns:70rpx 1fr 70rpx;align-items:center;gap:10rpx;margin-top:14rpx}.date{padding:18rpx;text-align:center;background:#f4f6f9;border-radius:14rpx;font-size:22rpx;font-weight:800}.timeline{display:grid;gap:14rpx;margin-top:22rpx}.entry{position:relative;display:flex;justify-content:space-between;gap:14rpx;width:100%;padding:23rpx;text-align:left;background:#fff;border:1rpx solid #dce4ed;border-left:12rpx solid #245ac8;border-radius:21rpx}.entry.timedplan{border-left-color:#ff826e}.entry.todo{border-left-color:#75d9be}.entry__type,.entry__title,.entry__meta{display:block}.entry__type{color:#6d7c91;font-size:18rpx;font-weight:900;letter-spacing:1rpx}.entry__title{margin-top:7rpx;color:#0a1830;font-size:27rpx;font-weight:900}.entry__title.done{text-decoration:line-through}.entry__meta{margin-top:7rpx;color:#63758e;font-size:20rpx}.series{color:#94a0b1;font-size:19rpx;font-weight:800}.complete{position:absolute;right:18rpx;bottom:15rpx;margin:0;padding:9rpx 13rpx;color:#08604e;background:#dff8f1;border-radius:12rpx;font-size:18rpx}.add-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9rpx;margin-top:22rpx}.add-grid button{margin:0;padding:20rpx 6rpx;border-radius:16rpx;font-size:20rpx;font-weight:900}.course{color:#174f91;background:#e5efff}.plan{color:#893d31;background:#ffe8e2}.todo{color:#075b49;background:#dff8f1}.limit{display:block;margin-top:18rpx;color:#6e7d91;font-size:20rpx;text-align:center}@media(min-width:680px){.content{padding:40px 40px 170px}.timeline{grid-template-columns:1fr 1fr}}
</style>
