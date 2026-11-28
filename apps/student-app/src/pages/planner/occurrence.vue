<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import type { PlannerOccurrence, SchoolPeriod } from '@codestrike/contracts'
import { createStudentApiClient } from '../../api/client'
import { formatPlannerDeadline, formatPlannerTime } from '../../api/planner'
import CsHeader from '../../components/CsHeader.vue'
import StatePanel from '../../components/StatePanel.vue'

const api = createStudentApiClient()
const personaAvailable = api.personaSwitchingAvailable
const occurrence = ref<PlannerOccurrence>()
const id = ref('')
const title = ref('')
const actualDate = ref('')
const startTime = ref('')
const endTime = ref('')
const startWeek = ref('1')
const weekdayIndex = ref(0)
const startPeriodIndex = ref(0)
const endPeriodIndex = ref(0)
const periods = ref<SchoolPeriod[]>([])
const room = ref('')
const description = ref('')
const deadline = ref('')
const error = ref('')
const feedback = ref('')
const feedbackError = ref(false)
const busy = ref(false)

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const apiCourseMode = computed(() => !personaAvailable && occurrence.value?.type === 'Course')

onLoad(async (options) => {
  id.value = typeof options?.id === 'string' ? decodeURIComponent(options.id) : ''
  periods.value = await api.listSchoolPeriods()
  await load()
})

function applyOccurrence(row: PlannerOccurrence) {
  occurrence.value = row
  title.value = row.title
  actualDate.value = row.actualDate
  startTime.value = formatPlannerTime(row.startTime)
  endTime.value = formatPlannerTime(row.endTime)
  room.value = row.room || ''
  description.value = row.description || ''
  deadline.value = formatPlannerDeadline(row.deadline)
  if (row.startWeek !== undefined) startWeek.value = String(row.startWeek)
  if (row.weekday !== undefined) weekdayIndex.value = Math.max(0, Math.min(6, row.weekday - 1))
  if (row.startPeriod !== undefined) {
    const found = periods.value.findIndex((p) => p.period === row.startPeriod)
    startPeriodIndex.value = found >= 0 ? found : Math.max(0, row.startPeriod - 1)
  }
  if (row.endPeriod !== undefined) {
    const found = periods.value.findIndex((p) => p.period === row.endPeriod)
    endPeriodIndex.value = found >= 0 ? found : Math.max(0, row.endPeriod - 1)
  }
}

async function load() {
  error.value = ''
  const result = await api.getPlannerOccurrence(id.value)
  if (!result.ok || !result.data) {
    error.value = result.message
    return
  }
  applyOccurrence(result.data)
}

function pickDate(event: { detail: { value: string } }) {
  actualDate.value = event.detail.value
}
function pickStartTime(event: { detail: { value: string } }) {
  startTime.value = event.detail.value
}
function pickEndTime(event: { detail: { value: string } }) {
  endTime.value = event.detail.value
}
function pickDeadline(event: { detail: { value: string } }) {
  deadline.value = event.detail.value
}

async function save() {
  if (busy.value || !occurrence.value) return
  busy.value = true
  feedback.value = ''
  feedbackError.value = false
  try {
    const result = await api.updatePlannerOccurrence(id.value, {
      title: title.value,
      actualDate: actualDate.value,
      startTime: startTime.value || undefined,
      endTime: endTime.value || undefined,
      ...(apiCourseMode.value
        ? {
            startWeek: Number(startWeek.value),
            weekday: weekdayIndex.value + 1,
            startPeriod: periods.value[startPeriodIndex.value]?.period || 1,
            endPeriod: periods.value[endPeriodIndex.value]?.period || 1,
          }
        : {}),
      room: room.value,
      description: description.value,
      deadline: deadline.value || undefined,
      clearDeadline: occurrence.value.type === 'Todo' && !deadline.value,
    })
    feedback.value = result.message
    feedbackError.value = !result.ok
    if (result.ok && result.data) applyOccurrence(result.data)
  } finally {
    busy.value = false
  }
}

async function toggle() {
  if (busy.value || !occurrence.value) return
  busy.value = true
  feedback.value = ''
  feedbackError.value = false
  try {
    const result = await api.togglePlannerTodo(id.value, !occurrence.value.completed)
    feedback.value = result.message
    feedbackError.value = !result.ok
    if (result.ok && result.data) applyOccurrence(result.data)
  } finally {
    busy.value = false
  }
}

function remove() {
  uni.showModal({
    title: 'Delete this occurrence?',
    content: 'Only this dated instance will be removed. The remaining series stays unchanged.',
    confirmText: 'Delete',
    success: async (modal) => {
      if (!modal.confirm || busy.value) return
      busy.value = true
      feedback.value = ''
      feedbackError.value = false
      try {
        const result = await api.deletePlannerOccurrence(id.value)
        feedback.value = result.message
        feedbackError.value = !result.ok
        if (result.ok) setTimeout(() => uni.navigateBack(), 400)
      } finally {
        busy.value = false
      }
    },
  })
}
</script>

<template>
  <view class="page-shell"><CsHeader back eyebrow="Planner" title="Edit occurrence" />
    <view class="content">
      <StatePanel v-if="error" title="Occurrence unavailable" :message="error" />
      <view v-else-if="occurrence" class="form">
        <view class="identity"><text>{{ occurrence.type }}</text><text v-if="personaAvailable || occurrence.occurrenceCount > 1">Occurrence {{ occurrence.occurrenceNumber }} of {{ occurrence.occurrenceCount }}</text><text v-else>{{ occurrence.actualDate }}</text></view>
        <text class="label">Title</text><input v-model="title" />

        <template v-if="apiCourseMode">
          <text class="label">Start week (semester week)</text>
          <input v-model="startWeek" type="number" />
          <text class="label">Weekday</text>
          <picker :range="weekdays" :value="weekdayIndex" @change="weekdayIndex = Number(($event as any).detail.value)">
            <view class="input">{{ weekdays[weekdayIndex] }}</view>
          </picker>
          <view class="split">
            <view>
              <text class="label">Start period</text>
              <picker :range="periods" range-key="period" :value="startPeriodIndex" @change="startPeriodIndex = Number(($event as any).detail.value)">
                <view class="input">Period {{ periods[startPeriodIndex]?.period }}</view>
              </picker>
            </view>
            <view>
              <text class="label">End period</text>
              <picker :range="periods" range-key="period" :value="endPeriodIndex" @change="endPeriodIndex = Number(($event as any).detail.value)">
                <view class="input">Period {{ periods[endPeriodIndex]?.period }}</view>
              </picker>
            </view>
          </view>
          <text class="label">Classroom · Optional</text><input v-model="room" />
        </template>

        <template v-else>
          <text class="label">Actual date</text><picker mode="date" :value="actualDate" @change="pickDate"><view class="input">{{ actualDate }}</view></picker>
          <view v-if="occurrence.type !== 'Todo'" class="split"><view><text class="label">Start time</text><picker mode="time" :value="startTime" @change="pickStartTime"><view class="input">{{ startTime }}</view></picker></view><view><text class="label">End time</text><picker mode="time" :value="endTime" @change="pickEndTime"><view class="input">{{ endTime }}</view></picker></view></view>
          <template v-if="occurrence.type === 'Course'"><text class="label">Classroom · Optional</text><input v-model="room" /></template>
          <template v-else-if="personaAvailable || occurrence.type === 'Todo'">
            <text class="label">Description · Optional</text><textarea v-model="description" />
            <template v-if="occurrence.type === 'Todo'">
              <text class="label">Deadline · Optional</text>
              <picker mode="date" :value="deadline || actualDate" @change="pickDeadline"><view class="input">{{ deadline || 'No deadline' }}</view></picker>
              <button v-if="deadline" class="clear-deadline" @click="deadline = ''">Clear deadline</button>
            </template>
          </template>
        </template>

        <button class="save" :disabled="busy" @click="save">Save This Occurrence</button>
        <button v-if="occurrence.type === 'Todo'" class="complete" :disabled="busy" @click="toggle">{{ occurrence.completed ? 'Mark Not Completed' : 'Mark Completed' }}</button>
        <button class="delete" :disabled="busy" @click="remove">Delete This Occurrence</button>
        <text class="scope">Changes apply only to this instance, not the whole finite series.</text><text class="stable">Stable ID: {{ occurrence.id }}</text>
      </view>
      <text v-if="feedback" class="feedback" :class="{ 'feedback--error': feedbackError }">{{ feedback }}</text>
    </view>
  </view>
</template>

<style scoped>
.content{max-width:820px;margin:auto;padding:26rpx}.form,.feedback{margin-top:18rpx;padding:24rpx;border-radius:22rpx}.form{background:#fff;border:1rpx solid #dce4ed}.identity{display:flex;flex-wrap:wrap;gap:10rpx;padding:18rpx;color:#174f91;background:#e5efff;border-radius:16rpx;font-size:20rpx;font-weight:850}.stable{width:100%;color:#5c708a;font-size:18rpx;word-break:break-all}.label,.scope{display:block}.label{margin-top:22rpx;color:#68778d;font-size:19rpx;font-weight:900;letter-spacing:1.2rpx}.input,input,textarea{width:100%;margin-top:9rpx;padding:19rpx;background:#f1f4f7;border-radius:15rpx;font-size:22rpx}.input,input{min-height:64rpx}textarea{height:130rpx}.split{display:grid;grid-template-columns:1fr 1fr;gap:12rpx}.save,.complete,.delete{width:100%;margin:20rpx 0 0;padding:20rpx;border-radius:16rpx;font-weight:900}.save{color:#0a1830;background:#d9ff74}.complete{color:#075b49;background:#dff8f1}.delete{color:#8a2f27;background:#ffe4de}.scope{margin-top:16rpx;color:#68788d;font-size:20rpx;text-align:center}.feedback{display:block;color:#075b49;background:#dff8f1;font-size:21rpx}@media(min-width:680px){.content{padding:40px}}
.content { max-width:820px; margin:0 auto; padding:20px 16px 40px; }.form,.feedback { margin-top:14px; padding:18px; border-radius:16px; }.form { background:#fff; border:1px solid #dfe4ea; }.identity { display:flex; flex-wrap:wrap; gap:7px 12px; padding:12px; color:#1e56b3; background:#eef4ff; border-radius:10px; font-size:13px; font-weight:700; }.label,.scope,.stable { display:block; }.label { margin-top:18px; color:#475467; font-size:14px; font-weight:700; letter-spacing:0; }.input,input,textarea { width:100%; min-height:46px; margin-top:7px; padding:12px 13px; color:#14213d; background:#f7f9fb; border:1px solid #dfe4ea; border-radius:11px; font-size:15px; }.textarea { height:105px; }.split { display:grid; grid-template-columns:1fr 1fr; gap:10px; }.clear-deadline { min-height:40px; margin:8px 0 0; padding:0 12px; color:#475467; background:#eef3f8; border-radius:9px; font-size:13px; font-weight:700; }.save,.complete,.delete { width:100%; min-height:48px; margin:14px 0 0; border-radius:11px; font-size:14px; font-weight:700; }.save { color:#fff; background:#2563eb; }.complete { color:#126b57; background:#edf8f4; }.delete { margin-top:22px; color:#fff; background:#b54742; }.scope { margin-top:13px; color:#667085; font-size:13px; line-height:1.45; text-align:left; }.stable { margin-top:6px; color:#8993a4; font-size:12px; word-break:break-all; }.feedback { display:block; color:#126b57; background:#edf8f4; border:1px solid #cbe9df; font-size:14px; }.feedback--error { color:#8a302b; background:#fff0ee; border-color:#f4cbc6; } @media(max-width:360px){.split{grid-template-columns:1fr}} @media(min-width:680px){.content{padding:28px 40px 48px}}
</style>
