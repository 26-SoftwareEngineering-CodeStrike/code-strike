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

const filteredCompetitions = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return competitions.value
  return competitions.value.filter((item) => item.title.toLowerCase().includes(keyword))
})

async function loadCompetitions(simulateFailure = false) {
  loading.value = true
  errorMessage.value = ''
  try {
    competitions.value = await api.listCompetitions({ simulateFailure })
  } catch (error) {
    competitions.value = []
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load competitions.'
  } finally {
    loading.value = false
  }
}

function openCompetition(id: string) {
  uni.navigateTo({ url: `/pages/competition/detail?id=${id}` })
}

function clearSearch() {
  query.value = ''
}

function submitCompetition() {
  uni.showModal({
    title: 'Prototype boundary',
    content: 'Competition submission is mapped to UI-08 and will be implemented in a later wave.',
    showCancel: false,
  })
}

loadCompetitions()
</script>

<template>
  <view class="page-shell">
    <CsHeader eyebrow="DISCOVER · CONNECT · COMPETE" title="Find the competition worth showing up for." />

    <view class="content">
      <view class="search-panel">
        <text class="search-panel__label">Competition Hub</text>
        <view class="search-box">
          <text class="search-box__mark">⌕</text>
          <input
            v-model="query"
            class="search-box__input"
            confirm-type="search"
            placeholder="Search competitions by name"
          />
          <button v-if="query" class="search-box__clear" aria-label="Clear search" @click="clearSearch">×</button>
        </view>
        <view class="search-panel__meta">
          <text>Published competitions only</text>
          <button class="inline-action" @click="submitCompetition">Submit a competition</button>
        </view>
      </view>

      <view class="section-heading">
        <view>
          <text class="section-heading__kicker">CURATED FOR CAMPUS TEAMS</text>
          <text class="section-heading__title">Explore competitions</text>
        </view>
        <text class="section-heading__count">{{ filteredCompetitions.length }}</text>
      </view>

      <StatePanel
        v-if="loading"
        title="Loading competitions"
        message="Reading deterministic prototype fixtures through MockTransport."
      />
      <StatePanel
        v-else-if="errorMessage"
        title="Competition feed unavailable"
        :message="errorMessage"
        action-label="Try again"
        @action="loadCompetitions()"
      />
      <StatePanel
        v-else-if="filteredCompetitions.length === 0"
        title="No matching competitions"
        message="Try another competition name or clear the current search."
        action-label="Clear search"
        @action="clearSearch"
      />
      <view v-else class="competition-grid">
        <CompetitionCard
          v-for="competition in filteredCompetitions"
          :key="competition.id"
          :competition="competition"
          @open="openCompetition"
        />
      </view>

      <view class="prototype-panel">
        <view>
          <text class="prototype-panel__label">PROTOTYPE CONTROL</text>
          <text class="prototype-panel__copy">Mock-only error state for UI review.</text>
        </view>
        <button class="prototype-panel__button" @click="loadCompetitions(true)">Simulate failure</button>
      </view>
    </view>

    <CsBottomNav active="Competitions" />
  </view>
</template>

<style scoped>
.content { max-width: 980px; margin: 0 auto; padding: 0 26rpx 180rpx; }
.search-panel { position: relative; z-index: 2; margin-top: -4rpx; padding: 30rpx 28rpx; background: #fff; border: 1rpx solid #dfe6ee; border-radius: 0 0 28rpx 28rpx; }
.search-panel__label { display: block; color: #0a1830; font-size: 21rpx; font-weight: 850; letter-spacing: 1rpx; }
.search-box { display: flex; align-items: center; height: 88rpx; margin-top: 18rpx; padding: 0 20rpx; background: #f1f5f8; border: 2rpx solid transparent; border-radius: 20rpx; box-sizing: border-box; }
.search-box:focus-within { border-color: #245ac8; background: #fff; }
.search-box__mark { margin-right: 14rpx; color: #245ac8; font-size: 36rpx; }
.search-box__input { flex: 1; min-width: 0; color: #142038; font-size: 24rpx; }
.search-box__clear { width: 52rpx; height: 52rpx; margin: 0; padding: 0; color: #657287; background: #e2e8ef; border-radius: 50%; font-size: 30rpx; line-height: 52rpx; }
.search-panel__meta { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; margin-top: 18rpx; color: #7f8b9d; font-size: 19rpx; }
.inline-action { flex-shrink: 0; margin: 0; padding: 8rpx 0; color: #245ac8; background: transparent; font-size: 20rpx; font-weight: 800; line-height: 1.2; }
.section-heading { display: flex; align-items: flex-end; justify-content: space-between; margin: 54rpx 2rpx 24rpx; }
.section-heading__kicker { display: block; color: #7e8a9c; font-size: 18rpx; font-weight: 800; letter-spacing: 2rpx; }
.section-heading__title { display: block; margin-top: 8rpx; color: #0a1830; font-size: 37rpx; font-weight: 850; }
.section-heading__count { color: #9ca7b6; font-size: 42rpx; font-weight: 850; }
.competition-grid { display: grid; grid-template-columns: 1fr; gap: 22rpx; }
.prototype-panel { display: flex; align-items: center; justify-content: space-between; gap: 22rpx; margin-top: 42rpx; padding: 24rpx; color: #dbe5f3; background: #13233e; border-radius: 24rpx; }
.prototype-panel__label,.prototype-panel__copy { display: block; }
.prototype-panel__label { color: #d9ff74; font-size: 17rpx; font-weight: 900; letter-spacing: 2rpx; }
.prototype-panel__copy { margin-top: 7rpx; font-size: 19rpx; }
.prototype-panel__button { flex-shrink: 0; margin: 0; padding: 16rpx 18rpx; color: #0a1830; background: #d9ff74; border-radius: 14rpx; font-size: 19rpx; font-weight: 850; line-height: 1.2; }
@media (min-width: 680px) {
  .content { padding-left: 36px; padding-right: 36px; }
  .search-panel { margin-top: -22px; border-radius: 26px; box-shadow: 0 18px 45px rgba(10,24,48,.12); }
  .competition-grid { grid-template-columns: repeat(2, minmax(0,1fr)); gap: 24px; }
}
</style>
