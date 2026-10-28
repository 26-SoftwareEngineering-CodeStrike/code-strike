<script setup lang="ts">
import type { CompetitionSummary } from '@codestrike/contracts'
import StatusBadge from './StatusBadge.vue'
defineProps<{ competition: CompetitionSummary }>()
defineEmits<{ (event: 'open', id: string): void }>()
const deadlineLabel = (value: string) => value.slice(0, 10)
</script>

<template>
  <button class="card" @click="$emit('open', competition.id)">
    <view class="card__accent" :class="`card__accent--${competition.coverTone.toLowerCase()}`" />
    <view class="card__body">
      <view class="card__rail"><text class="card__category">{{ competition.category }}</text><StatusBadge :label="competition.deadlineStatus === 'BeforeDeadline' ? 'Open' : 'Registration closed'" :tone="competition.deadlineStatus === 'BeforeDeadline' ? 'positive' : 'warning'" /></view>
      <text class="card__title">{{ competition.title }}</text>
      <text class="card__eligibility">{{ competition.eligibilitySummary }}</text>
      <view class="card__meta"><view><text class="card__meta-label">Registration deadline</text><text class="card__meta-value">{{ deadlineLabel(competition.registrationDeadline) }}</text></view><text class="card__arrow">›</text></view>
    </view>
  </button>
</template>

<style scoped>
.card { position: relative; display: flex; width: 100%; min-height: 0; margin: 0; padding: 0; overflow: hidden; text-align: left; background: #fff; border: 1px solid #dfe4ea; border-radius: 18px; }
.card__accent { width: 6px; flex: 0 0 auto; background: #2563eb; }
.card__accent--amber { background: #d69e2e; }.card__accent--forest { background: #16856b; }
.card__body { flex: 1; min-width: 0; padding: 18px; }
.card__rail { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.card__category { overflow: hidden; color: #667085; font-size: 13px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.card__title { display: block; margin-top: 13px; color: #14213d; font-size: 20px; font-weight: 750; line-height: 1.3; }
.card__eligibility { display: block; margin-top: 8px; color: #667085; font-size: 15px; line-height: 1.5; }
.card__meta { display: flex; align-items: flex-end; justify-content: space-between; margin-top: 16px; padding-top: 14px; border-top: 1px solid #e7ebf0; }
.card__meta-label,.card__meta-value { display: block; }.card__meta-label { color: #8993a4; font-size: 12px; }.card__meta-value { margin-top: 3px; color: #344054; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }.card__arrow { color: #2563eb; font-size: 28px; line-height: 1; }
</style>
