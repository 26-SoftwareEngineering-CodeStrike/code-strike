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
  <view class="page-shell"><CsHeader back eyebrow="UI-19 / SINGLE INSTANCE" title="Occurrence Actions" />
    <view class="content">
      <StatePanel v-if="error" title="Occurrence unavailable" :message="error" />
      <view v-else-if="occurrence" class="form">
        <view class="identity"><text>{{ occurrence.type }}</text><text>Occurrence {{ occurrence.occurrenceNumber }} of {{ occurrence.occurrenceCount }}</text><text class="stable">Stable ID: {{ occurrence.id }}</text></view>
        <text class="label">TITLE</text><input v-model="title" />
        <text class="label">ACTUAL DATE</text><picker mode="date" :value="actualDate" @change="pickDate"><view class="input">{{ actualDate }}</view></picker>
        <view v-if="occurrence.type !== 'Todo'" class="split"><view><text class="label">START TIME</text><picker mode="time" :value="startTime" @change="pickStartTime"><view class="input">{{ startTime }}</view></picker></view><view><text class="label">END TIME</text><picker mode="time" :value="endTime" @change="pickEndTime"><view class="input">{{ endTime }}</view></picker></view></view>
        <template v-if="occurrence.type === 'Course'"><text class="label">CLASSROOM / OPTIONAL</text><input v-model="room" /></template>
        <template v-else><text class="label">DESCRIPTION / OPTIONAL</text><textarea v-model="description" /><template v-if="occurrence.type === 'Todo'"><text class="label">DEADLINE / OPTIONAL</text><picker mode="date" :value="deadline || actualDate" @change="pickDeadline"><view class="input">{{ deadline || 'No deadline' }}</view></picker></template></template>
        <button class="save" @click="save">Save This Occurrence</button>
        <button v-if="occurrence.type === 'Todo'" class="complete" @click="toggle">{{ occurrence.completed ? 'Mark Not Completed' : 'Mark Completed' }}</button>
        <button class="delete" @click="remove">Delete This Occurrence</button>
        <text class="scope">Changes apply only to this instance, not the whole finite series.</text>
      </view>
      <text v-if="feedback" class="feedback">{{ feedback }}</text>
    </view>
  </view>
</template>

<style scoped>
.content{max-width:820px;margin:auto;padding:26rpx}.form,.feedback{margin-top:18rpx;padding:24rpx;border-radius:22rpx}.form{background:#fff;border:1rpx solid #dce4ed}.identity{display:flex;flex-wrap:wrap;gap:10rpx;padding:18rpx;color:#174f91;background:#e5efff;border-radius:16rpx;font-size:20rpx;font-weight:850}.stable{width:100%;color:#5c708a;font-size:18rpx;word-break:break-all}.label,.scope{display:block}.label{margin-top:22rpx;color:#68778d;font-size:19rpx;font-weight:900;letter-spacing:1.2rpx}.input,input,textarea{width:100%;margin-top:9rpx;padding:19rpx;background:#f1f4f7;border-radius:15rpx;font-size:22rpx}.input,input{min-height:64rpx}textarea{height:130rpx}.split{display:grid;grid-template-columns:1fr 1fr;gap:12rpx}.save,.complete,.delete{width:100%;margin:20rpx 0 0;padding:20rpx;border-radius:16rpx;font-weight:900}.save{color:#0a1830;background:#d9ff74}.complete{color:#075b49;background:#dff8f1}.delete{color:#8a2f27;background:#ffe4de}.scope{margin-top:16rpx;color:#68788d;font-size:20rpx;text-align:center}.feedback{display:block;color:#075b49;background:#dff8f1;font-size:21rpx}@media(min-width:680px){.content{padding:40px}}
</style>
