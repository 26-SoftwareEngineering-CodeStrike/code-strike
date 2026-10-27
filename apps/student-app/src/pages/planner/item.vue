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
  <view class="page-shell"><CsHeader back eyebrow="UI-18 / MANUAL ENTRY" :title="heading" />
    <view class="content">
      <view class="type-switch"><button :class="{ active: type === 'TimedPlan' }" @click="pickType('TimedPlan')">Timed Plan</button><button :class="{ active: type === 'Todo' }" @click="pickType('Todo')">To-do</button></view>
      <view class="notice">Overlaps are allowed. Saving this Mock item does not create a notification, reminder or backend task.</view>
      <view class="form">
        <text class="label">TITLE</text><input v-model="title" placeholder="Required title" />
        <text class="label">DESCRIPTION / OPTIONAL</text><textarea v-model="description" placeholder="Add a short private note" />
        <text class="label">ASSIGNED DATE</text><picker mode="date" :value="assignedDate" @change="pickDate"><view class="input">{{ assignedDate }}</view></picker>
        <template v-if="type === 'TimedPlan'"><view class="split"><view><text class="label">START TIME</text><picker mode="time" :value="startTime" @change="pickStartTime"><view class="input">{{ startTime }}</view></picker></view><view><text class="label">END TIME</text><picker mode="time" :value="endTime" @change="pickEndTime"><view class="input">{{ endTime }}</view></picker></view></view></template>
        <template v-else><text class="label">DEADLINE / OPTIONAL</text><picker mode="date" :value="deadline || assignedDate" @change="pickDeadline"><view class="input">{{ deadline || 'No deadline' }}</view></picker><text class="hint">Without a deadline, this to-do remains on its assigned date.</text></template>
        <text class="label">FINITE WEEKLY REPEAT</text><picker :range="repeats" :value="repeatIndex" @change="pickRepeat"><view class="input">{{ repeats[repeatIndex] }} occurrence(s)</view></picker>
        <view class="actions"><button class="cancel" @click="cancel">Cancel</button><button class="save" @click="save">Save {{ heading }}</button></view>
      </view>
      <text v-if="feedback" class="feedback">{{ feedback }}</text>
    </view>
  </view>
</template>

<style scoped>
.content{max-width:820px;margin:auto;padding:26rpx}.type-switch{display:grid;grid-template-columns:1fr 1fr;gap:8rpx;padding:8rpx;background:#e5eaf0;border-radius:18rpx}.type-switch button{margin:0;color:#607086;background:transparent;border-radius:13rpx;font-weight:900}.type-switch button.active{color:#fff;background:#245ac8}.notice,.form,.feedback{margin-top:18rpx;padding:24rpx;border-radius:22rpx}.notice{color:#185a4c;background:#dff8f1;font-size:21rpx;line-height:1.5}.form{background:#fff;border:1rpx solid #dce4ed}.label,.hint{display:block}.label{margin-top:22rpx;color:#68778d;font-size:19rpx;font-weight:900;letter-spacing:1.2rpx}.label:first-child{margin-top:0}.input,input,textarea{width:100%;margin-top:9rpx;padding:19rpx;background:#f1f4f7;border-radius:15rpx;font-size:22rpx}.input,input{min-height:64rpx}textarea{height:145rpx}.split{display:grid;grid-template-columns:1fr 1fr;gap:12rpx}.hint{margin-top:8rpx;color:#6b7a8e;font-size:19rpx}.actions{display:grid;grid-template-columns:1fr 2fr;gap:10rpx;margin-top:25rpx}.actions button{margin:0;padding:20rpx;border-radius:16rpx;font-weight:900}.cancel{color:#53647a;background:#edf1f5}.save{color:#0a1830;background:#d9ff74}.feedback{display:block;color:#075b49;background:#dff8f1;font-size:21rpx}@media(min-width:680px){.content{padding:40px}}
</style>
