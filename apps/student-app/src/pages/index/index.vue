<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CompetitionSummary } from '@codestrike/contracts'
import { createStudentApiClient } from '../../api/client'

const query = ref('')
const competitions = ref<CompetitionSummary[]>([])
const loading = ref(true)
const api = createStudentApiClient()

const filteredCompetitions = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return competitions.value
  return competitions.value.filter((item) => item.title.toLowerCase().includes(keyword))
})

api.listCompetitions().then((items) => {
  competitions.value = items
  loading.value = false
})

function showPrototypeNotice() {
  uni.showToast({ title: 'Phase 1 mock only', icon: 'none' })
}
</script>

<template>
  <view class="page-shell">
    <view class="hero">
      <view class="hero__eyebrow">CAMPUS COMPETITION COMMUNITY</view>
      <view class="hero__heading">Find a competition.<br />Build the right team.</view>
      <view class="hero__copy">Shared H5 and WeChat Mini Program shell · deterministic mock data</view>
      <view class="search">
        <text class="search__icon">⌕</text>
        <input v-model="query" class="search__input" confirm-type="search" placeholder="Search competitions by name" />
      </view>
    </view>

    <view class="section-heading">
      <view>
        <text class="section-heading__label">Competitions</text>
        <text class="section-heading__meta">{{ filteredCompetitions.length }} available</text>
      </view>
      <button class="text-button" @click="showPrototypeNotice">View all</button>
    </view>

    <view v-if="loading" class="state-card">Loading mock competitions…</view>
    <view v-else-if="filteredCompetitions.length === 0" class="state-card">No matching competitions.</view>

    <view v-for="competition in filteredCompetitions" :key="competition.id" class="competition-card" @click="showPrototypeNotice">
      <view class="competition-card__topline">
        <text class="category">{{ competition.category }}</text>
        <text class="status" :class="{ 'status--closed': competition.deadlineStatus === 'AfterDeadline' }">
          {{ competition.deadlineStatus === 'BeforeDeadline' ? 'OPEN' : 'REGISTRATION CLOSED' }}
        </text>
      </view>
      <text class="competition-card__title">{{ competition.title }}</text>
      <view class="competition-card__footer">
        <text>Community and recruitment</text><text class="arrow">→</text>
      </view>
    </view>

    <view class="mock-note">
      <text class="mock-note__title">Prototype boundary</text>
      <text class="mock-note__body">This screen uses fictional data through MockTransport. No account, database or real API is connected.</text>
    </view>

    <view class="tab-bar">
      <view class="tab tab--active"><text>Competitions</text></view>
      <view class="tab" @click="showPrototypeNotice"><text>My Teams</text></view>
      <view class="tab" @click="showPrototypeNotice"><text>Planner</text></view>
      <view class="tab" @click="showPrototypeNotice"><text>Me</text></view>
    </view>
  </view>
</template>

<style>
.page-shell { min-height: 100vh; padding: 0 28rpx 164rpx; box-sizing: border-box; }
.hero {
  margin: 0 -28rpx 40rpx; padding: 54rpx 36rpx 44rpx; color: #fff;
  background: linear-gradient(145deg, #10204a 0%, #174b9f 64%, #2877d5 100%);
  border-radius: 0 0 36rpx 36rpx;
}
.hero__eyebrow { font-size: 20rpx; letter-spacing: 3rpx; color: #a9c8ff; }
.hero__heading { margin-top: 24rpx; font-size: 52rpx; line-height: 1.12; font-weight: 720; }
.hero__copy { margin-top: 20rpx; font-size: 24rpx; line-height: 1.55; color: #d7e5ff; }
.search {
  display: flex; align-items: center; margin-top: 34rpx; padding: 0 24rpx; height: 88rpx;
  background: #fff; border-radius: 18rpx; box-shadow: 0 18rpx 48rpx rgba(3, 18, 52, 0.22);
}
.search__icon { margin-right: 16rpx; color: #385a91; font-size: 36rpx; }
.search__input { flex: 1; color: #172033; font-size: 27rpx; }
.section-heading, .competition-card__topline, .competition-card__footer { display: flex; align-items: center; justify-content: space-between; }
.section-heading { margin-bottom: 22rpx; }
.section-heading__label { display: block; font-size: 36rpx; font-weight: 700; }
.section-heading__meta { display: block; margin-top: 6rpx; color: #77839a; font-size: 22rpx; }
.text-button { margin: 0; padding: 12rpx 0 12rpx 24rpx; color: #1b5fbf; background: transparent; font-size: 24rpx; line-height: 1; }
.competition-card, .state-card, .mock-note {
  margin-bottom: 22rpx; padding: 28rpx; background: #fff; border: 1rpx solid #e5ebf4;
  border-radius: 22rpx; box-shadow: 0 10rpx 28rpx rgba(24, 53, 96, 0.07);
}
.category, .status { font-size: 20rpx; font-weight: 700; letter-spacing: 1rpx; }
.category { color: #1b5fbf; }
.status { padding: 8rpx 12rpx; color: #16784a; background: #e8f8f0; border-radius: 999rpx; }
.status--closed { color: #7a5760; background: #f4ecee; }
.competition-card__title { display: block; margin-top: 24rpx; min-height: 88rpx; font-size: 31rpx; line-height: 1.4; font-weight: 650; }
.competition-card__footer { margin-top: 24rpx; padding-top: 20rpx; color: #6b768b; border-top: 1rpx solid #edf1f6; font-size: 23rpx; }
.arrow { color: #1b5fbf; font-size: 34rpx; }
.state-card { color: #6b768b; text-align: center; }
.mock-note { margin-top: 34rpx; background: #eef5ff; border-color: #d3e3fb; }
.mock-note__title, .mock-note__body { display: block; }
.mock-note__title { color: #184f9a; font-size: 24rpx; font-weight: 700; }
.mock-note__body { margin-top: 10rpx; color: #506784; font-size: 22rpx; line-height: 1.6; }
.tab-bar {
  position: fixed; right: 24rpx; bottom: 22rpx; left: 24rpx; display: flex; padding: 14rpx 10rpx;
  background: rgba(255, 255, 255, 0.96); border: 1rpx solid #dfe7f2; border-radius: 24rpx;
  box-shadow: 0 16rpx 46rpx rgba(21, 48, 88, 0.18);
}
.tab { flex: 1; padding: 18rpx 4rpx; color: #8590a2; text-align: center; font-size: 21rpx; }
.tab--active { color: #155bbb; background: #eaf2ff; border-radius: 16rpx; font-weight: 700; }
</style>
