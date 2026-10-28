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
const labOpen = ref(false)
const scenarios = [{ id: 'team-alpha', label: 'Matched · Open' }, { id: 'team-beta', label: 'Not matched · Open' }, { id: 'team-gamma', label: 'Full' }, { id: 'team-epsilon', label: 'Manually closed' }, { id: 'team-archive', label: 'Deadline passed' }]
const actionCopy = computed(() => { const item = recruitment.value; if (!item) return { label: 'Unavailable', reason: 'Recruitment data is unavailable.' }; return { Open: { label: 'Apply to join', reason: item.matchStatus === 'NotMatched' ? 'You have no matching skill tag, but you can still apply.' : 'Your skills overlap with this team. The captain makes the final decision.' }, Full: { label: 'This team is full.', reason: 'Capacity includes the captain. New applications are closed.' }, ManuallyClosed: { label: 'Recruitment closed', reason: 'The captain is not accepting new applications.' }, RegistrationClosed: { label: 'Registration closed', reason: 'New admissions have ended, but the community remains available.' }, Delisted: { label: 'Unavailable', reason: 'This recruitment is not publicly available.' } }[item.availability] })
const canTryApply = computed(() => recruitment.value?.availability === 'Open')

onLoad((options) => { if (typeof options?.id === 'string' && options.id) recruitmentId.value = options.id; initialize() })
onShow(() => { if (recruitment.value) loadRecruitment(recruitmentId.value) })
async function initialize() { const [available, current] = await Promise.all([api.listPrototypeActors(), api.getPrototypeActor()]); actors.value = available.filter((actor) => ['visitor', 'student-alex'].includes(actor.id)); actorId.value = current.id; await loadRecruitment(recruitmentId.value) }
async function loadRecruitment(id: string) { recruitmentId.value = id; loading.value = true; errorMessage.value = ''; feedback.value = ''; try { recruitment.value = await api.getRecruitment(id) } catch (error) { recruitment.value = null; errorMessage.value = error instanceof Error ? error.message : 'Unable to load recruitment.' } finally { loading.value = false } }
async function choosePersona(value: string) { const result = await api.selectPrototypeActor(value); if (result.ok) actorId.value = value }
async function handleApply() { if (!recruitment.value) return; if (!canTryApply.value) { uni.showModal({ title: actionCopy.value.label, content: actionCopy.value.reason, showCancel: false }); return } const result = await api.applyToTeam(recruitment.value.id); feedback.value = result.message; uni.showToast({ title: result.message, icon: 'none' }) }
const formatDate = (value: string) => value.slice(0, 10)
function goToCompetitions() { uni.reLaunch({ url: '/pages/index/index' }) }
function openApplications() { uni.navigateTo({ url: '/pages/applications/history' }) }
</script>

<template>
  <view class="page-shell">
    <CsHeader back demo eyebrow="Team recruitment" :title="recruitment?.name || 'Recruitment'" @demo="labOpen = true" />
    <view class="content">
      <StatePanel v-if="loading" title="Loading recruitment" message="Getting the latest public team details." />
      <StatePanel v-else-if="errorMessage || !recruitment" title="Recruitment unavailable" :message="errorMessage || 'Recruitment not found.'" action-label="Back to competitions" @action="goToCompetitions" />
      <template v-else>
        <view class="hero">
          <view class="hero__rail"><StatusBadge :label="recruitment.availability === 'Open' ? 'Applications open' : actionCopy.label" :tone="recruitment.availability === 'Open' ? 'positive' : recruitment.availability === 'Full' ? 'danger' : 'warning'" /><text class="match">{{ recruitment.matchStatus === 'Matched' ? 'Your skills overlap' : 'No skill overlap' }}</text></view>
          <text class="competition">{{ recruitment.competitionTitle }}</text><text class="summary">{{ recruitment.summary }}</text>
          <view class="capacity"><view class="capacity__row"><text>Team capacity</text><text>{{ recruitment.memberCount }} / {{ recruitment.capacity }}</text></view><view class="track"><view class="fill" :style="{ width: `${(recruitment.memberCount / recruitment.capacity) * 100}%` }" /></view><text class="note">Captain included</text></view>
        </view>

        <view class="apply-panel"><text class="apply-panel__title">{{ actionCopy.label }}</text><text class="apply-panel__copy">{{ feedback || actionCopy.reason }}</text><button class="primary" :class="{ blocked: !canTryApply }" @click="handleApply">{{ actionCopy.label }}</button><button class="secondary" @click="openApplications">View my applications</button></view>

        <view class="details-panel">
          <view class="detail-row"><view><text class="label">Captain</text><text class="value">@{{ recruitment.captainUsername }}</text></view><text class="detail-row__note">Contact details stay private until membership is active.</text></view>
          <view class="detail-row"><view><text class="label">Registration deadline</text><text class="value">{{ formatDate(recruitment.competitionDeadline) }}</text></view><text class="detail-row__note">Community access continues after this date.</text></view>
          <view class="detail-row detail-row--skills"><view><text class="label">Skills this team needs</text><view class="skill-list"><text v-for="skill in recruitment.requiredSkills" :key="skill" class="skill">{{ skill }}</text></view></view><text class="detail-row__note">Skill matching is guidance only. You may apply without an overlap.</text></view>
        </view>
      </template>
    </view>
    <PersonaSwitcher :actors="actors" :selected-id="actorId" overlay :open="labOpen" @select="choosePersona" @close="labOpen = false"><template #tools><view class="scenario-tools"><text class="scenario-tools__label">Public recruitment state</text><scroll-view class="scenario-panel__scroll" scroll-x :show-scrollbar="false"><view class="scenario-panel__items"><button v-for="scenario in scenarios" :key="scenario.id" class="scenario-chip" :class="{ active: recruitment?.id === scenario.id }" @click="loadRecruitment(scenario.id)">{{ scenario.label }}</button></view></scroll-view></view></template></PersonaSwitcher>
    <CsBottomNav active="Competitions" />
  </view>
</template>

<style scoped>
.content { max-width: 860px; margin: 0 auto; padding: 18px 16px; padding-bottom: calc(128px + constant(safe-area-inset-bottom)); padding-bottom: calc(128px + env(safe-area-inset-bottom)); }.hero { padding: 20px; background: #fff; border: 1px solid #dfe4ea; border-radius: 18px; }.hero__rail { display: flex; align-items: center; justify-content: space-between; gap: 12px; }.match { color: #2563eb; font-size: 13px; font-weight: 700; }.competition,.summary,.label,.value,.note,.detail-row__note,.apply-panel__title,.apply-panel__copy,.scenario-tools__label { display: block; }.competition { margin-top: 15px; color: #2563eb; font-size: 14px; font-weight: 700; }.summary { margin-top: 7px; color: #344054; font-size: 17px; line-height: 1.5; }.capacity { margin-top: 18px; padding-top: 16px; border-top: 1px solid #e7ebf0; }.capacity__row { display: flex; justify-content: space-between; color: #344054; font-size: 14px; font-weight: 700; }.track { height: 8px; margin-top: 10px; overflow: hidden; background: #e8edf3; border-radius: 99px; }.fill { height: 100%; background: #16856b; }.note { margin-top: 7px; color: #667085; font-size: 13px; line-height: 1.45; }
.details-panel { margin-top: 12px; padding: 0 18px; background: #fff; border: 1px solid #dfe4ea; border-radius: 15px; }.detail-row { display: grid; grid-template-columns: minmax(0,1fr) minmax(180px,1fr); gap: 18px; align-items: center; padding: 16px 0; border-bottom: 1px solid #e7ebf0; }.detail-row:last-child { border-bottom: 0; }.label { color: #667085; font-size: 13px; font-weight: 700; }.value { margin-top: 5px; color: #14213d; font-size: 17px; font-weight: 750; }.detail-row__note { color: #667085; font-size: 13px; line-height: 1.45; }.skill-list { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 9px; }.skill { padding: 5px 9px; color: #1e56b3; background: #eef4ff; border-radius: 7px; font-size: 13px; font-weight: 700; }
.apply-panel { margin-top: 14px; padding: 18px; background: #edf4ff; border: 1px solid #cfddf7; border-radius: 16px; }.apply-panel__title { color: #14213d; font-size: 18px; font-weight: 750; }.apply-panel__copy { margin-top: 5px; color: #526581; font-size: 14px; line-height: 1.5; }.primary,.secondary { width: 100%; min-height: 48px; margin: 14px 0 0; border-radius: 12px; font-size: 15px; font-weight: 700; }.primary { color: #fff; background: #2563eb; }.primary.blocked { color: #7a3f38; background: #f4d7d2; }.secondary { margin-top: 8px; color: #1e56b3; background: transparent; border: 1px solid #bcd0f2; }
.scenario-tools { padding: 2px 0 4px; }.scenario-tools__label { padding: 0 18px; color: #667085; font-size: 13px; font-weight: 700; }.scenario-panel__scroll { margin: 9px 0 4px; white-space: nowrap; }.scenario-panel__items { display: inline-flex; gap: 8px; padding: 0 18px; }.scenario-chip { min-height: 44px; margin: 0; padding: 0 13px; color: #475467; background: #fff; border: 1px solid #dfe4ea; border-radius: 10px; font-size: 13px; }.scenario-chip.active { color: #fff; background: #2563eb; border-color: #2563eb; font-weight: 700; }
@media (min-width: 680px) { .content { padding: 26px 40px calc(138px + env(safe-area-inset-bottom)); } }
@media (max-width: 520px) { .detail-row { display: block; }.detail-row__note { margin-top: 8px; } }
</style>
