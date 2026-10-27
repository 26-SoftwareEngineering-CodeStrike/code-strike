<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import type { MyTeamItem, PrototypeActor } from '@codestrike/contracts'
import { createStudentApiClient } from '../../api/client'
import CsBottomNav from '../../components/CsBottomNav.vue'
import CsHeader from '../../components/CsHeader.vue'
import PersonaSwitcher from '../../components/PersonaSwitcher.vue'
import StatePanel from '../../components/StatePanel.vue'
import StatusBadge from '../../components/StatusBadge.vue'

const api = createStudentApiClient()
const actors = ref<PrototypeActor[]>([])
const actorId = ref('visitor')
const currentTeams = ref<MyTeamItem[]>([])
const historyTeams = ref<MyTeamItem[]>([])
const loading = ref(true)
const errorMessage = ref('')
const feedback = ref('')

onShow(initialize)
async function initialize() {
  const [available, current] = await Promise.all([api.listPrototypeActors(), api.getPrototypeActor()])
  actors.value = available.filter((actor) => ['visitor', 'student-alex', 'student-incomplete', 'captain-alpha', 'alpha-successor', 'captain-delta', 'former-captain-alpha'].includes(actor.id))
  actorId.value = current.id
  await loadTeams()
}
async function selectActor(id: string) { const result = await api.selectPrototypeActor(id); if (result.ok) actorId.value = id; feedback.value = result.message; await loadTeams() }
async function loadTeams() {
  loading.value = true; errorMessage.value = ''
  const result = await api.listMyTeams()
  if (result.ok && result.data) { currentTeams.value = result.data.current; historyTeams.value = result.data.history }
  else { currentTeams.value = []; historyTeams.value = []; errorMessage.value = result.message }
  loading.value = false
}
function openRecruitment(teamId: string) { uni.navigateTo({ url: `/pages/teams/recruitment?id=${teamId}` }) }
function openReview(teamId: string) { uni.navigateTo({ url: `/pages/captain/review?id=${teamId}` }) }
function openOperations(teamId: string) { uni.navigateTo({ url: `/pages/teams/operations?id=${teamId}` }) }
function openCreate() { uni.navigateTo({ url: '/pages/teams/create' }) }
function openApplications() { uni.navigateTo({ url: '/pages/applications/history' }) }
function publicationTone(status: string): 'positive' | 'warning' | 'danger' | 'neutral' { if (status === 'Published') return 'positive'; if (status === 'Rejected' || status === 'Delisted') return 'danger'; if (status === 'Pending') return 'warning'; return 'neutral' }
</script>

<template>
  <view class="page-shell"><CsHeader eyebrow="UI-11 · MEMBERSHIP HOME" title="My Teams" />
    <view class="content"><PersonaSwitcher :actors="actors" :selected-id="actorId" @select="selectActor" />
      <text v-if="feedback" class="feedback">{{ feedback }}</text>
      <StatePanel v-if="loading" title="Loading team memberships" message="Reading active and ended memberships separately from application history." />
      <StatePanel v-else-if="errorMessage" title="Student access required" :message="errorMessage" />
      <template v-else>
        <view class="section-head"><view><text class="section-head__label">ACTIVE MEMBERSHIP</text><text class="section-head__title">Current teams</text></view><text class="section-head__count">{{ currentTeams.length }}</text></view>
        <StatePanel v-if="currentTeams.length === 0" compact title="No current team" message="Historical Approved applications do not create a current membership." />
        <view v-for="team in currentTeams" :key="team.membershipId" class="team-card">
          <view class="team-card__top"><view><text class="competition">{{ team.competitionTitle }}</text><text class="team-name">{{ team.name }}</text></view><StatusBadge :label="team.membershipRole.toUpperCase()" :tone="team.membershipRole === 'Captain' ? 'info' : 'neutral'" /></view>
          <view class="badges"><StatusBadge :label="team.lifecycle.toUpperCase()" :tone="team.lifecycle === 'Active' ? 'positive' : 'danger'" /><StatusBadge :label="team.publication.toUpperCase()" :tone="publicationTone(team.publication)" /><StatusBadge :label="`RECRUITMENT ${team.recruitmentSwitch.toUpperCase()}`" :tone="team.recruitmentSwitch === 'Open' ? 'positive' : 'warning'" /></view>
          <view class="facts"><view><text class="fact__label">CAPTAIN</text><text class="fact__value">@{{ team.captainUsername }}</text></view><view><text class="fact__label">MEMBERS</text><text class="fact__value">{{ team.memberCount }} / {{ team.capacity }}</text></view></view>
          <view class="actions"><button v-if="team.canManageRecruitment" class="manage-recruitment" @click="openRecruitment(team.id)">Manage recruitment</button><button v-if="team.canReviewApplications" class="review-applications" @click="openReview(team.id)">Review applications</button><button class="manage-members" @click="openOperations(team.id)">{{ team.canManageMembers ? 'Manage members' : 'View team / Leave' }}</button></view>
        </view>

        <view class="section-head history-head"><view><text class="section-head__label">OWNER-SPECIFIC HISTORY</text><text class="section-head__title">Past teams</text></view><text class="section-head__count">{{ historyTeams.length }}</text></view>
        <StatePanel v-if="historyTeams.length === 0" compact title="No team history" message="Ended memberships and dissolved teams will remain as concise owner history." />
        <view v-for="team in historyTeams" :key="team.membershipId" class="history-card"><view><text class="competition">{{ team.competitionTitle }}</text><text class="history-card__name">{{ team.name }}</text></view><view class="badges"><StatusBadge label="ENDED MEMBERSHIP" tone="neutral" /><StatusBadge :label="team.lifecycle.toUpperCase()" :tone="team.lifecycle === 'Dissolved' ? 'danger' : 'neutral'" /></view><text class="history-card__note">No teammate contacts or captain controls are available from history.</text></view>
        <view class="global-actions"><button class="create" @click="openCreate">Create a Team</button><button @click="openApplications">View My Applications</button></view>
      </template>
      <text class="disclaimer">Membership is the source of current team access. Application history is displayed separately.</text>
    </view><CsBottomNav active="Teams" /></view>
</template>

<style scoped>
.content{max-width:900px;margin:0 auto;padding:28rpx 26rpx 210rpx}.feedback{display:block;margin:18rpx 0;padding:18rpx 20rpx;color:#25405f;background:#e4f4ff;border-radius:16rpx;font-size:21rpx}.section-head{display:flex;align-items:flex-end;justify-content:space-between;margin:28rpx 2rpx 14rpx}.section-head__label,.section-head__title,.competition,.fact__label,.fact__value,.history-card__name,.history-card__note,.disclaimer{display:block}.section-head__label{color:#68778d;font-size:20rpx;font-weight:900;letter-spacing:1.4rpx}.section-head__title{margin-top:6rpx;font-size:34rpx;font-weight:900}.section-head__count{color:#9aa6b5;font-size:35rpx;font-weight:900}.team-card,.history-card{margin-top:16rpx;padding:27rpx;background:#fff;border:1rpx solid #dfe6ee;border-radius:27rpx}.team-card__top{display:flex;align-items:flex-start;justify-content:space-between;gap:14rpx}.competition{color:#65748a;font-size:20rpx;line-height:1.35}.team-name{display:block;margin-top:7rpx;font-size:31rpx;font-weight:900}.badges{display:flex;flex-wrap:wrap;gap:9rpx;margin-top:20rpx}.facts{display:grid;grid-template-columns:1fr 1fr;gap:12rpx;margin-top:21rpx;padding-top:20rpx;border-top:1rpx solid #e5eaf0}.fact__label{color:#778499;font-size:18rpx;font-weight:900;letter-spacing:1.3rpx}.fact__value{margin-top:7rpx;color:#263750;font-size:22rpx;font-weight:800}.actions{display:grid;gap:10rpx;margin-top:22rpx}.actions button,.global-actions button{margin:0;padding:19rpx;color:#245ac8;background:#e8f0ff;border-radius:16rpx;font-size:22rpx;font-weight:850;line-height:1.2}.history-head{margin-top:36rpx}.history-card__name{margin-top:7rpx;font-size:27rpx;font-weight:850}.history-card__note{margin-top:16rpx;color:#68778d;font-size:21rpx;line-height:1.5}.global-actions{display:grid;grid-template-columns:1fr 1fr;gap:12rpx;margin-top:28rpx}.global-actions .create{color:#0a1830;background:#d9ff74}.disclaimer{margin-top:20rpx;color:#6f7d91;font-size:20rpx;line-height:1.5;text-align:center}@media(min-width:680px){.content{padding:40px 40px 170px}.actions{grid-template-columns:repeat(3,1fr)}}
</style>
