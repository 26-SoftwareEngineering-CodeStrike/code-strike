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
const labOpen = ref(false)

onShow(initialize)
async function initialize() { const [available, current] = await Promise.all([api.listPrototypeActors(), api.getPrototypeActor()]); actors.value = available.filter((actor) => ['visitor', 'student-alex', 'student-incomplete', 'captain-alpha', 'alpha-successor', 'captain-delta', 'former-captain-alpha'].includes(actor.id)); actorId.value = current.id; await loadTeams() }
async function selectActor(id: string) { const result = await api.selectPrototypeActor(id); if (result.ok) actorId.value = id; await loadTeams() }
async function loadTeams() { loading.value = true; errorMessage.value = ''; const result = await api.listMyTeams(); if (result.ok && result.data) { currentTeams.value = result.data.current; historyTeams.value = result.data.history } else { currentTeams.value = []; historyTeams.value = []; errorMessage.value = result.message } loading.value = false }
function openRecruitment(teamId: string) { uni.navigateTo({ url: `/pages/teams/recruitment?id=${teamId}` }) }
function openReview(teamId: string) { uni.navigateTo({ url: `/pages/captain/review?id=${teamId}` }) }
function openOperations(teamId: string) { uni.navigateTo({ url: `/pages/teams/operations?id=${teamId}` }) }
function openCreate() { uni.navigateTo({ url: '/pages/teams/create' }) }
function openApplications() { uni.navigateTo({ url: '/pages/applications/history' }) }
function publicationTone(status: string): 'positive' | 'warning' | 'danger' | 'neutral' { if (status === 'Published') return 'positive'; if (status === 'Rejected' || status === 'Delisted') return 'danger'; if (status === 'Pending') return 'warning'; return 'neutral' }
</script>

<template>
  <view class="page-shell">
    <CsHeader demo eyebrow="Memberships" title="My teams" @demo="labOpen = true" />
    <view class="content">
      <view class="intro"><text class="intro__title">Your team space</text><text class="intro__copy">Current memberships and captain actions are kept separate from application history.</text></view>
      <StatePanel v-if="loading" title="Loading your teams" message="Getting your current and past memberships." />
      <StatePanel v-else-if="errorMessage" title="Student access required" :message="errorMessage" />
      <template v-else>
        <view class="section-head"><text class="section-head__title">Current teams</text><text class="section-head__count">{{ currentTeams.length }}</text></view>
        <StatePanel v-if="currentTeams.length === 0" compact title="No current team" message="Join a recruiting team or create your own." />
        <view v-for="team in currentTeams" :key="team.membershipId" class="team-card">
          <view class="team-card__top"><view><text class="competition">{{ team.competitionTitle }}</text><text class="team-name">{{ team.name }}</text></view><StatusBadge :label="team.membershipRole.toUpperCase()" :tone="team.membershipRole === 'Captain' ? 'info' : 'neutral'" /></view>
          <view class="team-card__status"><StatusBadge :label="team.publication.toUpperCase()" :tone="publicationTone(team.publication)" /><text>{{ team.lifecycle }}</text><text>Recruitment {{ team.recruitmentSwitch.toLowerCase() }}</text></view>
          <view class="facts"><view><text class="fact__label">Captain</text><text class="fact__value">@{{ team.captainUsername }}</text></view><view><text class="fact__label">Members</text><text class="fact__value">{{ team.memberCount }} / {{ team.capacity }}</text></view></view>
          <view class="actions"><button v-if="team.canManageRecruitment" class="manage-recruitment" @click="openRecruitment(team.id)">Manage recruitment</button><button v-if="team.canReviewApplications" class="review-applications" @click="openReview(team.id)">Review applications</button><button class="manage-members" @click="openOperations(team.id)">{{ team.canManageMembers ? 'Manage members' : 'View team / Leave' }}</button></view>
        </view>

        <view class="section-head history-head"><text class="section-head__title">Past teams</text><text class="section-head__count">{{ historyTeams.length }}</text></view>
        <StatePanel v-if="historyTeams.length === 0" compact title="No team history" message="Ended memberships will appear here." />
        <view v-for="team in historyTeams" :key="team.membershipId" class="history-card"><view><text class="competition">{{ team.competitionTitle }}</text><text class="history-card__name">{{ team.name }}</text></view><view class="history-card__meta"><StatusBadge label="ENDED MEMBERSHIP" tone="neutral" /><StatusBadge :label="team.lifecycle.toUpperCase()" :tone="team.lifecycle === 'Dissolved' ? 'danger' : 'neutral'" /></view><text class="history-card__note">Team contacts and captain actions are no longer available.</text></view>
        <view class="global-actions"><button class="create" @click="openCreate">Create a team</button><button @click="openApplications">My applications</button></view>
      </template>
    </view>
    <PersonaSwitcher :actors="actors" :selected-id="actorId" overlay :open="labOpen" @select="selectActor" @close="labOpen = false" />
    <CsBottomNav active="Teams" />
  </view>
</template>

<style scoped>
.content { max-width: 900px; margin: 0 auto; padding: 20px 16px; padding-bottom: calc(128px + constant(safe-area-inset-bottom)); padding-bottom: calc(128px + env(safe-area-inset-bottom)); }.intro__title,.intro__copy,.section-head__title,.competition,.team-name,.fact__label,.fact__value,.history-card__name,.history-card__note { display: block; }.intro__title { color: #14213d; font-size: 26px; font-weight: 780; line-height: 1.2; }.intro__copy { max-width: 620px; margin-top: 6px; color: #667085; font-size: 15px; line-height: 1.5; }
.section-head { display: flex; align-items: center; justify-content: space-between; margin: 28px 2px 12px; }.section-head__title { color: #14213d; font-size: 20px; font-weight: 750; }.section-head__count { display: flex; align-items: center; justify-content: center; min-width: 28px; height: 28px; color: #475467; background: #e8edf3; border-radius: 8px; font-size: 14px; font-weight: 750; }
.team-card,.history-card { margin-top: 12px; padding: 18px; background: #fff; border: 1px solid #dfe4ea; border-radius: 17px; }.team-card__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }.competition { color: #667085; font-size: 13px; line-height: 1.35; }.team-name { margin-top: 4px; color: #14213d; font-size: 20px; font-weight: 750; }.team-card__status { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-top: 14px; color: #667085; font-size: 13px; }.facts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; padding-top: 14px; border-top: 1px solid #e7ebf0; }.fact__label { color: #667085; font-size: 12px; }.fact__value { margin-top: 3px; color: #344054; font-size: 15px; font-weight: 700; }.actions { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; margin-top: 16px; }.actions .manage-members { grid-column: 1 / -1; }.actions button,.global-actions button { min-height: 46px; margin: 0; padding: 0 10px; color: #1e56b3; background: #eef4ff; border-radius: 11px; font-size: 14px; font-weight: 700; line-height: 1.25; }
.history-head { margin-top: 32px; }.history-card__name { margin-top: 4px; color: #14213d; font-size: 18px; font-weight: 750; }.history-card__meta { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 13px; }.history-card__note { margin-top: 11px; color: #667085; font-size: 14px; line-height: 1.45; }.global-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px; }.global-actions .create { color: #14213d; background: #c9f43d; }
@media (min-width: 680px) { .content { padding: 28px 40px calc(138px + env(safe-area-inset-bottom)); } }
@media (max-width: 340px) { .global-actions { grid-template-columns: 1fr; } }
</style>
