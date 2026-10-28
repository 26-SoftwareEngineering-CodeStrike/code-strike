<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CompetitionSummary } from '@codestrike/contracts'
import CompetitionCard from '../../components/CompetitionCard.vue'
import CsBottomNav from '../../components/CsBottomNav.vue'
import CsHeader from '../../components/CsHeader.vue'
import StatePanel from '../../components/StatePanel.vue'
import { createStudentApiClient } from '../../api/client'

const api = createStudentApiClient()
const query = ref('')
const competitions = ref<CompetitionSummary[]>([])
const loading = ref(true)
const errorMessage = ref('')
const labOpen = ref(false)
const filteredCompetitions = computed(() => { const keyword = query.value.trim().toLowerCase(); return keyword ? competitions.value.filter((item) => item.title.toLowerCase().includes(keyword)) : competitions.value })

async function loadCompetitions(simulateFailure = false) { loading.value = true; errorMessage.value = ''; try { competitions.value = await api.listCompetitions({ simulateFailure }) } catch (error) { competitions.value = []; errorMessage.value = error instanceof Error ? error.message : 'Unable to load competitions.' } finally { loading.value = false } }
function openCompetition(id: string) { uni.navigateTo({ url: `/pages/competition/detail?id=${id}` }) }
function clearSearch() { query.value = '' }
function submitCompetition() { uni.showModal({ title: 'Not available in this pilot', content: 'Competition submission is outside the current student prototype scope.', showCancel: false }) }
loadCompetitions()
</script>

<template>
  <view class="page-shell">
    <CsHeader demo eyebrow="Campus competitions" title="Discover" @demo="labOpen = true" />
    <view class="content">
      <view class="intro"><text class="intro__title">Find your next competition</text><text class="intro__copy">Explore published opportunities, communities and teams in one place.</text></view>
      <view class="search-box">
        <text class="search-box__mark">⌕</text>
        <input v-model="query" class="search-box__input" confirm-type="search" placeholder="Search by competition name" />
        <button v-if="query" class="search-box__clear" aria-label="Clear search" @click="clearSearch">×</button>
      </view>
      <view class="search-meta"><text>Published competitions</text><button class="inline-action" @click="submitCompetition">Submit competition</button></view>

      <view class="section-heading"><text class="section-heading__title">Competitions</text><text class="section-heading__count">{{ filteredCompetitions.length }}</text></view>
      <StatePanel v-if="loading" title="Loading competitions" message="Getting the latest published competitions." />
      <StatePanel v-else-if="errorMessage" title="Competition feed unavailable" :message="errorMessage" action-label="Try again" @action="loadCompetitions()" />
      <StatePanel v-else-if="filteredCompetitions.length === 0" title="No matching competitions" message="Try another name or clear your search." action-label="Clear search" @action="clearSearch" />
      <view v-else class="competition-grid"><CompetitionCard v-for="competition in filteredCompetitions" :key="competition.id" :competition="competition" @open="openCompetition" /></view>

    </view>
    <view v-show="labOpen" class="prototype-overlay"><button class="prototype-overlay__backdrop" aria-label="Close Prototype Lab" @click="labOpen = false" /><view class="prototype-sheet" role="dialog" aria-label="Prototype Lab"><view class="prototype-sheet__head"><view><text class="prototype-sheet__title">Prototype Lab</text><text class="prototype-sheet__copy">Local display controls only</text></view><button class="prototype-sheet__close" aria-label="Close Prototype Lab" @click="labOpen = false">×</button></view><text class="prototype-sheet__note">This control changes a deterministic Mock response. It is not authentication or a backend connection.</text><button class="prototype-sheet__action" @click="loadCompetitions(true); labOpen = false">Simulate failure</button></view></view>
    <CsBottomNav active="Competitions" />
  </view>
</template>

<style scoped>
.content { max-width: 980px; margin: 0 auto; padding: 22px 16px; padding-bottom: calc(128px + constant(safe-area-inset-bottom)); padding-bottom: calc(128px + env(safe-area-inset-bottom)); }
.intro__title,.intro__copy { display: block; }.intro__title { color: #14213d; font-size: 28px; font-weight: 780; line-height: 1.2; letter-spacing: -.025em; }.intro__copy { max-width: 560px; margin-top: 7px; color: #667085; font-size: 15px; line-height: 1.5; }
.search-box { display: flex; align-items: center; min-height: 50px; margin-top: 20px; padding: 0 12px; background: #fff; border: 1px solid #d7dee7; border-radius: 14px; }.search-box:focus-within { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.1); }.search-box__mark { margin-right: 9px; color: #2563eb; font-size: 22px; }.search-box__input { flex: 1; min-width: 0; height: 48px; color: #14213d; font-size: 16px; }.search-box__clear { width: 38px; height: 38px; min-height: 38px; margin: 0; padding: 0; color: #667085; background: #eef3f8; border-radius: 10px; font-size: 22px; line-height: 38px; }
.search-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 9px 2px 0; color: #667085; font-size: 13px; }.inline-action { min-height: 44px; margin: -8px 0; padding: 0 4px; color: #2563eb; background: transparent; font-size: 14px; font-weight: 700; }
.section-heading { display: flex; align-items: center; justify-content: space-between; margin: 30px 2px 14px; }.section-heading__title { color: #14213d; font-size: 21px; font-weight: 750; }.section-heading__count { display: flex; align-items: center; justify-content: center; min-width: 28px; height: 28px; color: #475467; background: #e8edf3; border-radius: 8px; font-size: 14px; font-weight: 750; }
.competition-grid { display: grid; grid-template-columns: 1fr; gap: 13px; }
.prototype-overlay { position: fixed; z-index: 40; inset: 0; display: flex; align-items: flex-end; justify-content: center; }.prototype-overlay__backdrop { position: absolute; inset: 0; width: 100%; height: 100%; min-height: 100%; margin: 0; padding: 0; background: rgba(20,33,61,.42); border-radius: 0; }.prototype-sheet { position: relative; width: 100%; max-width: 720px; padding: 18px 18px calc(18px + constant(safe-area-inset-bottom)); padding-bottom: calc(18px + env(safe-area-inset-bottom)); background: #fff; border-radius: 20px 20px 0 0; }.prototype-sheet__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }.prototype-sheet__title,.prototype-sheet__copy,.prototype-sheet__note { display: block; }.prototype-sheet__title { color: #14213d; font-size: 16px; font-weight: 750; }.prototype-sheet__copy { margin-top: 2px; color: #667085; font-size: 13px; }.prototype-sheet__close { width: 44px; height: 44px; min-height: 44px; margin: 0; padding: 0; color: #475467; background: #eef3f8; border-radius: 12px; font-size: 24px; line-height: 44px; }.prototype-sheet__note { margin-top: 12px; color: #667085; font-size: 13px; line-height: 1.45; }.prototype-sheet__action { width: 100%; min-height: 46px; margin: 14px 0 0; color: #fff; background: #2563eb; border-radius: 12px; font-size: 14px; font-weight: 700; }
@media (min-width: 680px) { .content { padding: 30px 36px calc(138px + env(safe-area-inset-bottom)); }.competition-grid { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 18px; } }
</style>
