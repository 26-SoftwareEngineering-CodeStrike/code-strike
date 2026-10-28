<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import type { PlannerItemType } from '@codestrike/contracts'
import { createStudentApiClient } from '../../api/client'
import CsHeader from '../../components/CsHeader.vue'

const api = createStudentApiClient()
const type = ref<Extract<PlannerItemType, 'TimedPlan' | 'Todo'>>('TimedPlan')
const title = ref('')
const description = ref('')
const assignedDate = ref('2026-10-27')
const startTime = ref('10:00')
const endTime = ref('11:00')
const deadline = ref('')
const repeatIndex = ref(0)
const feedback = ref('')
const repeats = Array.from({ length: 12 }, (_, index) => index + 1)
const heading = computed(() => type.value === 'TimedPlan' ? 'Timed Plan' : 'To-do')

onLoad((options) => {
  if (options?.type === 'Todo') type.value = 'Todo'
  if (typeof options?.date === 'string') assignedDate.value = options.date
})

function pickType(next: 'TimedPlan' | 'Todo') { type.value = next; feedback.value = '' }
function pickDate(event: { detail: { value: string } }) { assignedDate.value = event.detail.value }
function pickStartTime(event: { detail: { value: string } }) { startTime.value = event.detail.value }
function pickEndTime(event: { detail: { value: string } }) { endTime.value = event.detail.value }
function pickDeadline(event: { detail: { value: string } }) { deadline.value = event.detail.value }
function pickRepeat(event: { detail: { value: string } }) { repeatIndex.value = Number(event.detail.value) }
function cancel() { uni.navigateBack() }
async function save() {
  const result = await api.createPlannerItem({
    type: type.value,
    title: title.value,
    description: description.value,
    assignedDate: assignedDate.value,
    startTime: type.value === 'TimedPlan' ? startTime.value : undefined,
    endTime: type.value === 'TimedPlan' ? endTime.value : undefined,
    deadline: type.value === 'Todo' && deadline.value ? deadline.value : undefined,
    repeatCount: repeats[repeatIndex.value],
  })
  feedback.value = result.message
}
</script>

<template>
  <view class="page-shell"><CsHeader back eyebrow="Planner" :title="heading" />
    <view class="content">
      <view class="intro"><text class="intro__title">{{ type === 'TimedPlan' ? 'Schedule focused time' : 'Add a flexible to-do' }}</text><text class="intro__copy">{{ type === 'TimedPlan' ? 'Choose a start and end time for this plan.' : 'Keep it on an assigned date and add a deadline only when needed.' }}</text></view>
      <view class="type-switch"><button :class="{ active: type === 'TimedPlan' }" @click="pickType('TimedPlan')">Timed Plan</button><button :class="{ active: type === 'Todo' }" @click="pickType('Todo')">To-do</button></view>
      <view class="notice">Overlaps are allowed. This planner does not create notifications or reminders.</view>
      <view class="form">
        <text class="label">Title</text><input v-model="title" placeholder="Required title" />
        <text class="label">Description · Optional</text><textarea v-model="description" placeholder="Add a short private note" />
        <text class="label">Assigned date</text><picker mode="date" :value="assignedDate" @change="pickDate"><view class="input">{{ assignedDate }}</view></picker>
        <template v-if="type === 'TimedPlan'"><view class="split"><view><text class="label">Start time</text><picker mode="time" :value="startTime" @change="pickStartTime"><view class="input">{{ startTime }}</view></picker></view><view><text class="label">End time</text><picker mode="time" :value="endTime" @change="pickEndTime"><view class="input">{{ endTime }}</view></picker></view></view></template>
        <template v-else><text class="label">Deadline · Optional</text><picker mode="date" :value="deadline || assignedDate" @change="pickDeadline"><view class="input">{{ deadline || 'No deadline' }}</view></picker><text class="hint">Without a deadline, this to-do remains on its assigned date.</text></template>
        <text class="label">Weekly repeat</text><picker :range="repeats" :value="repeatIndex" @change="pickRepeat"><view class="input">{{ repeats[repeatIndex] }} occurrence(s)</view></picker>
        <view class="actions"><button class="cancel" @click="cancel">Cancel</button><button class="save" @click="save">Save {{ heading }}</button></view>
      </view>
      <text v-if="feedback" class="feedback">{{ feedback }}</text>
    </view>
  </view>
</template>

<style scoped>
.content{max-width:820px;margin:auto;padding:26rpx}.type-switch{display:grid;grid-template-columns:1fr 1fr;gap:8rpx;padding:8rpx;background:#e5eaf0;border-radius:18rpx}.type-switch button{margin:0;color:#607086;background:transparent;border-radius:13rpx;font-weight:900}.type-switch button.active{color:#fff;background:#245ac8}.notice,.form,.feedback{margin-top:18rpx;padding:24rpx;border-radius:22rpx}.notice{color:#185a4c;background:#dff8f1;font-size:21rpx;line-height:1.5}.form{background:#fff;border:1rpx solid #dce4ed}.label,.hint{display:block}.label{margin-top:22rpx;color:#68778d;font-size:19rpx;font-weight:900;letter-spacing:1.2rpx}.label:first-child{margin-top:0}.input,input,textarea{width:100%;margin-top:9rpx;padding:19rpx;background:#f1f4f7;border-radius:15rpx;font-size:22rpx}.input,input{min-height:64rpx}textarea{height:145rpx}.split{display:grid;grid-template-columns:1fr 1fr;gap:12rpx}.hint{margin-top:8rpx;color:#6b7a8e;font-size:19rpx}.actions{display:grid;grid-template-columns:1fr 2fr;gap:10rpx;margin-top:25rpx}.actions button{margin:0;padding:20rpx;border-radius:16rpx;font-weight:900}.cancel{color:#53647a;background:#edf1f5}.save{color:#0a1830;background:#d9ff74}.feedback{display:block;color:#075b49;background:#dff8f1;font-size:21rpx}@media(min-width:680px){.content{padding:40px}}
.content { max-width:820px; margin:0 auto; padding:20px 16px 40px; }.intro__title,.intro__copy { display:block; }.intro__title { color:#14213d; font-size:26px; font-weight:780; line-height:1.2; }.intro__copy { margin-top:6px; color:#667085; font-size:15px; line-height:1.5; }.type-switch { display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-top:18px; padding:5px; background:#eef3f8; border-radius:13px; }.type-switch button { min-height:44px; margin:0; color:#667085; background:transparent; border-radius:9px; font-size:14px; font-weight:700; }.type-switch button.active { color:#14213d; background:#fff; box-shadow:0 1px 3px rgba(20,33,61,.08); }.notice,.form,.feedback { margin-top:14px; padding:16px; border-radius:15px; }.notice { color:#126b57; background:#edf8f4; border:1px solid #cbe9df; font-size:14px; line-height:1.45; }.form { background:#fff; border:1px solid #dfe4ea; }.label,.hint { display:block; }.label { margin-top:18px; color:#475467; font-size:14px; font-weight:700; letter-spacing:0; }.label:first-child { margin-top:0; }.input,input,textarea { width:100%; min-height:46px; margin-top:7px; padding:12px 13px; color:#14213d; background:#f7f9fb; border:1px solid #dfe4ea; border-radius:11px; font-size:15px; }.textarea { height:105px; }.split { display:grid; grid-template-columns:1fr 1fr; gap:10px; }.hint { margin-top:6px; color:#667085; font-size:13px; }.actions { display:grid; grid-template-columns:1fr 2fr; gap:8px; margin-top:20px; }.actions button { min-height:48px; margin:0; border-radius:11px; font-size:14px; font-weight:700; }.cancel { color:#475467; background:#eef3f8; }.save { color:#fff; background:#2563eb; }.feedback { display:block; color:#126b57; background:#edf8f4; border:1px solid #cbe9df; font-size:14px; } @media(max-width:360px){.split{grid-template-columns:1fr}} @media(min-width:680px){.content{padding:28px 40px 48px}}
</style>
