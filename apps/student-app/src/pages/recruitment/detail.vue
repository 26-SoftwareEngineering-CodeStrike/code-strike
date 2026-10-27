<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import type { PrototypeActor, RecruitmentDetail } from '@codestrike/contracts'
import { createStudentApiClient } from '../../api/client'
import CsBottomNav from '../../components/CsBottomNav.vue'
import CsHeader from '../../components/CsHeader.vue'
import PersonaSwitcher from '../../components/PersonaSwitcher.vue'
import StatePanel from '../../components/StatePanel.vue'
import StatusBadge from '../../components/StatusBadge.vue'

const api = createStudentApiClient()
const recruitmentId = ref('team-alpha')
const recruitment = ref<RecruitmentDetail | null>(null)
const actors = ref<PrototypeActor[]>([])
const actorId = ref('visitor')
const loading = ref(true)
const errorMessage = ref('')
const feedback = ref('')
const scenarios = [
  { id: 'team-alpha', label: 'Matched · Open' }, { id: 'team-beta', label: 'Not matched · Open' },
  { id: 'team-gamma', label: 'Full' }, { id: 'team-epsilon', label: 'Manually closed' },
  { id: 'team-archive', label: 'Deadline passed' },
]
const actionCopy = computed(() => {
  const item = recruitment.value
  if (!item) return { label: 'Unavailable', reason: 'Recruitment data is unavailable.' }
  return {
    Open: { label: 'Apply to join', reason: item.matchStatus === 'NotMatched' ? 'No shared skill tag. You may still apply; matching is advisory only.' : 'At least one skill tag overlaps. The captain still decides.' },
    Full: { label: 'This team is full.', reason: 'Capacity includes the captain. New applications are blocked.' },
    ManuallyClosed: { label: 'Recruitment closed', reason: 'The captain manually closed new applications.' },
    RegistrationClosed: { label: 'Registration closed', reason: 'New admissions stop, but the community remains readable.' },
    Delisted: { label: 'Unavailable', reason: 'Delisted details are never returned by this public page.' },
  }[item.availability]
})
const canTryApply = computed(() => recruitment.value?.availability === 'Open')

onLoad((options) => { if (typeof options?.id === 'string' && options.id) recruitmentId.value = options.id; initialize() })
onShow(() => { if (recruitment.value) loadRecruitment(recruitmentId.value) })

async function initialize() {
  const [available, current] = await Promise.all([api.listPrototypeActors(), api.getPrototypeActor()])
  actors.value = available.filter((actor) => ['visitor', 'student-alex'].includes(actor.id))
  actorId.value = current.id
  await loadRecruitment(recruitmentId.value)
}
async function loadRecruitment(id: string) {
  recruitmentId.value = id; loading.value = true; errorMessage.value = ''; feedback.value = ''
  try { recruitment.value = await api.getRecruitment(id) }
  catch (error) { recruitment.value = null; errorMessage.value = error instanceof Error ? error.message : 'Unable to load recruitment.' }
  finally { loading.value = false }
}
async function choosePersona(value: string) {
  const result = await api.selectPrototypeActor(value); if (result.ok) actorId.value = value; feedback.value = result.message
}
async function handleApply() {
  if (!recruitment.value) return
  if (!canTryApply.value) { uni.showModal({ title: actionCopy.value.label, content: actionCopy.value.reason, showCancel: false }); return }
  const result = await api.applyToTeam(recruitment.value.id); feedback.value = result.message; uni.showToast({ title: result.message, icon: 'none' })
}
function formatDate(value: string) { return value.slice(0, 10) }
function goToCompetitions() { uni.reLaunch({ url: '/pages/index/index' }) }
function openApplications() { uni.navigateTo({ url: '/pages/applications/history' }) }
</script>

<template>
  <view class="page-shell">
    <CsHeader back eyebrow="RECRUITMENT DETAIL" :title="recruitment?.name || 'Recruitment'" />
    <view class="content">
      <StatePanel v-if="loading" title="Loading recruitment" message="Resolving a public MockTransport scenario." />
      <StatePanel v-else-if="errorMessage || !recruitment" title="Recruitment unavailable" :message="errorMessage || 'Recruitment not found.'" action-label="Back to competitions" @action="goToCompetitions" />
      <template v-else>
        <view class="scenario-panel"><text class="scenario-panel__label">PUBLIC DEMO STATES</text><scroll-view class="scenario-panel__scroll" scroll-x :show-scrollbar="false"><view class="scenario-panel__items"><button v-for="scenario in scenarios" :key="scenario.id" class="scenario-chip" :class="{ active: recruitment.id === scenario.id }" @click="loadRecruitment(scenario.id)">{{ scenario.label }}</button></view></scroll-view></view>
        <view class="card">
          <view class="badges"><StatusBadge label="PUBLISHED" tone="positive" /><StatusBadge :label="recruitment.matchStatus === 'Matched' ? 'SKILL MATCHED' : 'NOT MATCHED'" :tone="recruitment.matchStatus === 'Matched' ? 'info' : 'neutral'" /></view>
          <text class="competition">{{ recruitment.competitionTitle }}</text><text class="summary">{{ recruitment.summary }}</text>
          <view class="capacity"><view class="row"><text>Current membership</text><text>{{ recruitment.memberCount }} / {{ recruitment.capacity }}</text></view><view class="track"><view class="fill" :style="{ width: `${(recruitment.memberCount / recruitment.capacity) * 100}%` }" /></view><text class="note">Captain included in capacity</text></view>
        </view>
        <view class="detail-grid"><view class="card"><text class="label">CAPTAIN</text><text class="value">@{{ recruitment.captainUsername }}</text><text class="note">No contact details are shown publicly.</text></view><view class="card"><text class="label">REGISTRATION DEADLINE</text><text class="value">{{ formatDate(recruitment.competitionDeadline) }}</text><text class="note">Community access continues after this date.</text></view></view>
        <view class="card skills"><text class="label">REQUIRED SKILLS</text><view class="skill-list"><text v-for="skill in recruitment.requiredSkills" :key="skill" class="skill">{{ skill }}</text></view><text class="note">Skill overlap is advisory. Sex and MBTI never influence matching.</text></view>
        <view class="card actions"><PersonaSwitcher :actors="actors" :selected-id="actorId" compact @select="choosePersona" /><view class="message" :class="{ blocked: !canTryApply }"><text class="message__title">{{ actionCopy.label }}</text><text class="message__copy">{{ feedback || actionCopy.reason }}</text></view><button class="primary" :class="{ blocked: !canTryApply }" @click="handleApply">{{ actionCopy.label }}</button><button class="secondary" @click="openApplications">View my applications</button><text class="disclaimer">Prototype state only. No real account, server authorization or database workflow is connected.</text></view>
      </template>
    </view><CsBottomNav active="Competitions" />
  </view>
</template>

<style scoped>
.content{max-width:860px;margin:0 auto;padding:28rpx 26rpx 210rpx}.scenario-panel{margin-bottom:22rpx;padding:24rpx 0 22rpx;color:#dce6f5;background:#13233e;border-radius:24rpx}.scenario-panel__label{display:block;padding:0 24rpx;color:#d9ff74;font-size:20rpx;font-weight:900;letter-spacing:1.5rpx}.scenario-panel__scroll{margin-top:18rpx;white-space:nowrap}.scenario-panel__items{display:inline-flex;gap:10rpx;padding:0 24rpx}.scenario-chip{margin:0;padding:16rpx 19rpx;color:#c8d4e5;background:rgba(255,255,255,.08);border:1rpx solid rgba(255,255,255,.13);border-radius:999rpx;font-size:21rpx;line-height:1.15}.scenario-chip.active{color:#0a1830;background:#fff;font-weight:850}.card{padding:28rpx;background:#fff;border:1rpx solid #dfe6ee;border-radius:28rpx}.badges,.skill-list{display:flex;flex-wrap:wrap;gap:10rpx}.competition,.summary,.label,.value,.note,.message__title,.message__copy,.disclaimer{display:block}.competition{margin-top:24rpx;color:#245ac8;font-size:22rpx;font-weight:800}.summary{margin-top:12rpx;color:#3d4b62;font-size:25rpx;line-height:1.6}.capacity{margin-top:28rpx;padding-top:24rpx;border-top:1rpx solid #e6ebf1}.row{display:flex;justify-content:space-between;color:#223149;font-size:22rpx;font-weight:800}.track{height:14rpx;margin-top:15rpx;overflow:hidden;background:#e8edf2;border-radius:999rpx}.fill{height:100%;background:#5fddc4}.detail-grid{display:grid;gap:18rpx;margin-top:20rpx}.label{color:#748196;font-size:20rpx;font-weight:900;letter-spacing:1.5rpx}.value{margin-top:13rpx;color:#0a1830;font-size:27rpx;font-weight:850}.note{margin-top:10rpx;color:#65748a;font-size:21rpx;line-height:1.5}.skills,.actions{margin-top:20rpx}.skill-list{margin-top:18rpx}.skill{padding:11rpx 16rpx;color:#193f78;background:#e6f0ff;border-radius:13rpx;font-size:21rpx;font-weight:800}.message{margin-top:22rpx;padding:20rpx;background:#e3faf4;border-radius:18rpx}.message.blocked{background:#fff1de}.message__title{font-size:23rpx;font-weight:850}.message__copy{margin-top:8rpx;color:#596a81;font-size:21rpx;line-height:1.5}.primary,.secondary{width:100%;margin:18rpx 0 0;padding:22rpx;border-radius:18rpx;font-size:24rpx;font-weight:850;line-height:1.2}.primary{color:#0a1830;background:#d9ff74}.primary.blocked{color:#704331;background:#ffd8c8}.secondary{color:#245ac8;background:#e8f0ff}.disclaimer{margin-top:18rpx;color:#758196;font-size:20rpx;line-height:1.5;text-align:center}@media(min-width:680px){.content{padding:40px 40px 170px}.detail-grid{grid-template-columns:1fr 1fr}}
</style>
