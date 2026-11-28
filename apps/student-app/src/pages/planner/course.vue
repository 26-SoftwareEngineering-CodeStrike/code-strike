<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import type { SchoolPeriod } from '@codestrike/contracts'
import { createStudentApiClient } from '../../api/client'
import CsHeader from '../../components/CsHeader.vue'

const api = createStudentApiClient()
const personaAvailable = api.personaSwitchingAvailable
const name = ref('')
const startWeek = ref('2026-10-26')
const startWeekNumber = ref('1')
const weekdayIndex = ref(1)
const startPeriodIndex = ref(personaAvailable ? 2 : 0)
const endPeriodIndex = ref(personaAvailable ? 3 : 1)
const room = ref('')
const repeatIndex = ref(3)
const periods = ref<SchoolPeriod[]>([])
const feedback = ref('')
const feedbackError = ref(false)
const saving = ref(false)

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const repeats = Array.from({ length: 12 }, (_, i) => i + 1)
const preview = computed(() => repeats[repeatIndex.value] + ' weekly occurrence(s), including the selected start week')

onLoad(async (options) => {
  if (typeof options?.date === 'string') startWeek.value = weekMonday(options.date)
  periods.value = await api.listSchoolPeriods()
})

function weekMonday(value: string) {
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - (day - 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function periodLabel(period?: SchoolPeriod) {
  if (!period) return ''
  return period.startTime ? `Period ${period.period} · ${period.startTime}` : `Period ${period.period}`
}

function endPeriodLabel(period?: SchoolPeriod) {
  if (!period) return ''
  return period.endTime ? `Period ${period.period} · ${period.endTime}` : `Period ${period.period}`
}

async function save() {
  if (saving.value) return
  saving.value = true
  feedback.value = ''
  feedbackError.value = false
  try {
    const parsedWeek = Number(startWeekNumber.value)
    const result = await api.createCourse({
      name: name.value,
      actualStartWeek: startWeek.value,
      ...(!personaAvailable ? { startWeek: parsedWeek } : {}),
      weekday: weekdayIndex.value + 1,
      startPeriod: periods.value[startPeriodIndex.value]?.period || 1,
      endPeriod: periods.value[endPeriodIndex.value]?.period || 1,
      room: room.value,
      repeatCount: repeats[repeatIndex.value],
    })
    feedback.value = result.message
    feedbackError.value = !result.ok
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="page-shell">
    <CsHeader back eyebrow="Planner" title="Add course" />
    <view class="content">
      <view class="intro">
        <text class="intro__title">Add a repeating course</text>
        <text class="intro__copy">Set the first week, meeting day and period range.</text>
      </view>
      <view class="notice">
        {{
          personaAvailable
            ? 'The period table is an example for this prototype, not an official university timetable.'
            : 'Course dates and clock times are computed by the server from its configured semester start date and period timetable.'
        }}
      </view>
      <view class="form">
        <text class="label">Course name</text>
        <input v-model="name" class="field-course-name" placeholder="e.g. Design Research" />
        <template v-if="personaAvailable">
          <text class="label">Actual start week (Monday)</text>
          <picker mode="date" :value="startWeek" @change="startWeek = ($event as any).detail.value">
            <view class="input">{{ startWeek }}</view>
          </picker>
        </template>
        <template v-else>
          <text class="label">Start week (semester week)</text>
          <input v-model="startWeekNumber" class="field-course-week" type="number" placeholder="1" />
        </template>
        <text class="label">Weekday</text>
        <picker :range="weekdays" :value="weekdayIndex" @change="weekdayIndex = Number(($event as any).detail.value)">
          <view class="input">{{ weekdays[weekdayIndex] }}</view>
        </picker>
        <view class="split">
          <view>
            <text class="label">Start period</text>
            <picker :range="periods" range-key="period" :value="startPeriodIndex" @change="startPeriodIndex = Number(($event as any).detail.value)">
              <view class="input">{{ periodLabel(periods[startPeriodIndex]) }}</view>
            </picker>
          </view>
          <view>
            <text class="label">End period</text>
            <picker :range="periods" range-key="period" :value="endPeriodIndex" @change="endPeriodIndex = Number(($event as any).detail.value)">
              <view class="input">{{ endPeriodLabel(periods[endPeriodIndex]) }}</view>
            </picker>
          </view>
        </view>
        <text class="label">Classroom · Optional</text>
        <input v-model="room" class="field-course-room" placeholder="Example Room B204" />
        <text class="label">Weekly repeat</text>
        <picker :range="repeats" :value="repeatIndex" @change="repeatIndex = Number(($event as any).detail.value)">
          <view class="input">{{ repeats[repeatIndex] }} weeks</view>
        </picker>
        <text class="preview">{{ preview }}</text>
        <button class="save" :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Save Course' }}</button>
      </view>
      <text v-if="feedback" class="feedback" :class="{ 'feedback--error': feedbackError }">{{ feedback }}</text>
    </view>
  </view>
</template>

<style scoped>
.content { max-width:820px; margin:0 auto; padding:20px 16px 40px; }
.intro__title,.intro__copy { display:block; }.intro__title { color:#14213d; font-size:26px; font-weight:780; line-height:1.2; }.intro__copy { margin-top:6px; color:#667085; font-size:15px; }
.notice,.form,.feedback { margin-top:14px; padding:16px; border-radius:15px; }.notice { color:#6f4a00; background:#fff8e7; border:1px solid #f1dfae; font-size:14px; line-height:1.45; }.form { background:#fff; border:1px solid #dfe4ea; }
.label { display:block; margin-top:18px; color:#475467; font-size:14px; font-weight:700; letter-spacing:0; }.label:first-child { margin-top:0; }.input,input { width:100%; min-height:46px; margin-top:7px; padding:12px 13px; color:#14213d; background:#f7f9fb; border:1px solid #dfe4ea; border-radius:11px; font-size:15px; }
.split { display:grid; grid-template-columns:1fr 1fr; gap:10px; }.preview { display:block; margin-top:14px; color:#667085; font-size:13px; }.save { display:flex; align-items:center; justify-content:center; width:100%; min-height:48px; margin:20px 0 0; color:#fff; background:#2563eb; border-radius:12px; font-size:15px; font-weight:700; line-height:1.2; }.feedback { display:block; color:#126b57; background:#edf8f4; border:1px solid #cbe9df; font-size:14px; }.feedback--error { color:#8a302b; background:#fff0ee; border-color:#f4cbc6; }
@media(max-width:360px){.split{grid-template-columns:1fr}} @media(min-width:680px){.content{padding:28px 40px 48px}}
</style>
