<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import type { PlannerOccurrence } from '@codestrike/contracts'
import { createStudentApiClient } from '../../api/client'
import CsHeader from '../../components/CsHeader.vue'
import StatePanel from '../../components/StatePanel.vue'

const api = createStudentApiClient()
const occurrence = ref<PlannerOccurrence>()
const id = ref('')
const title = ref('')
const actualDate = ref('')
const startTime = ref('')
const endTime = ref('')
const room = ref('')
const description = ref('')
const deadline = ref('')
const error = ref('')
const feedback = ref('')

onLoad(async (options) => { id.value = typeof options?.id === 'string' ? options.id : ''; await load() })
async function load() {
  const result = await api.getPlannerOccurrence(id.value)
  if (!result.ok || !result.data) { error.value = result.message; return }
  occurrence.value = result.data; title.value = result.data.title; actualDate.value = result.data.actualDate
  startTime.value = result.data.startTime || ''; endTime.value = result.data.endTime || ''; room.value = result.data.room || ''
  description.value = result.data.description || ''; deadline.value = result.data.deadline || ''
}
function pickDate(event: { detail: { value: string } }) { actualDate.value = event.detail.value }
function pickStartTime(event: { detail: { value: string } }) { startTime.value = event.detail.value }
function pickEndTime(event: { detail: { value: string } }) { endTime.value = event.detail.value }
function pickDeadline(event: { detail: { value: string } }) { deadline.value = event.detail.value }
async function save() {
  const result = await api.updatePlannerOccurrence(id.value, { title: title.value, actualDate: actualDate.value, startTime: startTime.value || undefined, endTime: endTime.value || undefined, room: room.value, description: description.value, deadline: deadline.value || undefined })
  feedback.value = result.message
  if (result.ok && result.data) occurrence.value = result.data
}
async function toggle() { const result = await api.togglePlannerTodo(id.value); feedback.value = result.message; if (result.ok && result.data) occurrence.value = result.data }
function remove() {
  uni.showModal({ title: 'Delete this occurrence?', content: 'Only this dated instance will be removed. The remaining series stays unchanged.', confirmText: 'Delete', success: async (modal) => { if (!modal.confirm) return; const result = await api.deletePlannerOccurrence(id.value); feedback.value = result.message; if (result.ok) setTimeout(() => uni.navigateBack(), 500) } })
}
</script>

<template>
  <view class="page-shell"><CsHeader back eyebrow="Planner" title="Edit occurrence" />
    <view class="content">
      <StatePanel v-if="error" title="Occurrence unavailable" :message="error" />
      <view v-else-if="occurrence" class="form">
        <view class="identity"><text>{{ occurrence.type }}</text><text>Occurrence {{ occurrence.occurrenceNumber }} of {{ occurrence.occurrenceCount }}</text></view>
        <text class="label">Title</text><input v-model="title" />
        <text class="label">Actual date</text><picker mode="date" :value="actualDate" @change="pickDate"><view class="input">{{ actualDate }}</view></picker>
        <view v-if="occurrence.type !== 'Todo'" class="split"><view><text class="label">Start time</text><picker mode="time" :value="startTime" @change="pickStartTime"><view class="input">{{ startTime }}</view></picker></view><view><text class="label">End time</text><picker mode="time" :value="endTime" @change="pickEndTime"><view class="input">{{ endTime }}</view></picker></view></view>
        <template v-if="occurrence.type === 'Course'"><text class="label">Classroom · Optional</text><input v-model="room" /></template>
        <template v-else><text class="label">Description · Optional</text><textarea v-model="description" /><template v-if="occurrence.type === 'Todo'"><text class="label">Deadline · Optional</text><picker mode="date" :value="deadline || actualDate" @change="pickDeadline"><view class="input">{{ deadline || 'No deadline' }}</view></picker></template></template>
        <button class="save" @click="save">Save This Occurrence</button>
        <button v-if="occurrence.type === 'Todo'" class="complete" @click="toggle">{{ occurrence.completed ? 'Mark Not Completed' : 'Mark Completed' }}</button>
        <button class="delete" @click="remove">Delete This Occurrence</button>
        <text class="scope">Changes apply only to this instance, not the whole finite series.</text><text class="stable">Stable ID: {{ occurrence.id }}</text>
      </view>
      <text v-if="feedback" class="feedback">{{ feedback }}</text>
    </view>
  </view>
</template>

<style scoped>
.content{max-width:820px;margin:auto;padding:26rpx}.form,.feedback{margin-top:18rpx;padding:24rpx;border-radius:22rpx}.form{background:#fff;border:1rpx solid #dce4ed}.identity{display:flex;flex-wrap:wrap;gap:10rpx;padding:18rpx;color:#174f91;background:#e5efff;border-radius:16rpx;font-size:20rpx;font-weight:850}.stable{width:100%;color:#5c708a;font-size:18rpx;word-break:break-all}.label,.scope{display:block}.label{margin-top:22rpx;color:#68778d;font-size:19rpx;font-weight:900;letter-spacing:1.2rpx}.input,input,textarea{width:100%;margin-top:9rpx;padding:19rpx;background:#f1f4f7;border-radius:15rpx;font-size:22rpx}.input,input{min-height:64rpx}textarea{height:130rpx}.split{display:grid;grid-template-columns:1fr 1fr;gap:12rpx}.save,.complete,.delete{width:100%;margin:20rpx 0 0;padding:20rpx;border-radius:16rpx;font-weight:900}.save{color:#0a1830;background:#d9ff74}.complete{color:#075b49;background:#dff8f1}.delete{color:#8a2f27;background:#ffe4de}.scope{margin-top:16rpx;color:#68788d;font-size:20rpx;text-align:center}.feedback{display:block;color:#075b49;background:#dff8f1;font-size:21rpx}@media(min-width:680px){.content{padding:40px}}
.content { max-width:820px; margin:0 auto; padding:20px 16px 40px; }.form,.feedback { margin-top:14px; padding:18px; border-radius:16px; }.form { background:#fff; border:1px solid #dfe4ea; }.identity { display:flex; flex-wrap:wrap; gap:7px 12px; padding:12px; color:#1e56b3; background:#eef4ff; border-radius:10px; font-size:13px; font-weight:700; }.label,.scope,.stable { display:block; }.label { margin-top:18px; color:#475467; font-size:14px; font-weight:700; letter-spacing:0; }.input,input,textarea { width:100%; min-height:46px; margin-top:7px; padding:12px 13px; color:#14213d; background:#f7f9fb; border:1px solid #dfe4ea; border-radius:11px; font-size:15px; }.textarea { height:105px; }.split { display:grid; grid-template-columns:1fr 1fr; gap:10px; }.save,.complete,.delete { width:100%; min-height:48px; margin:14px 0 0; border-radius:11px; font-size:14px; font-weight:700; }.save { color:#fff; background:#2563eb; }.complete { color:#126b57; background:#edf8f4; }.delete { margin-top:22px; color:#fff; background:#b54742; }.scope { margin-top:13px; color:#667085; font-size:13px; line-height:1.45; text-align:left; }.stable { margin-top:6px; color:#8993a4; font-size:12px; word-break:break-all; }.feedback { display:block; color:#126b57; background:#edf8f4; border:1px solid #cbe9df; font-size:14px; } @media(max-width:360px){.split{grid-template-columns:1fr}} @media(min-width:680px){.content{padding:28px 40px 48px}}
</style>
