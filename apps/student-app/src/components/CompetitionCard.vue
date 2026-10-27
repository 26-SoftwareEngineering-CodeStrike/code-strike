<script setup lang="ts">
import type { CompetitionSummary } from '@codestrike/contracts'
import StatusBadge from './StatusBadge.vue'

defineProps<{ competition: CompetitionSummary }>()
defineEmits<{ (event: 'open', id: string): void }>()

function deadlineLabel(value: string) {
  return value.slice(0, 10)
}
</script>

<template>
  <button class="card" @click="$emit('open', competition.id)">
    <view class="card__cover" :class="`card__cover--${competition.coverTone.toLowerCase()}`">
      <text class="card__category">{{ competition.category }}</text>
      <text class="card__number">0{{ competition.id.endsWith('1') ? '1' : '2' }}</text>
    </view>
    <view class="card__body">
      <view class="card__status">
        <StatusBadge
          :label="competition.deadlineStatus === 'BeforeDeadline' ? 'OPEN' : 'REGISTRATION CLOSED'"
          :tone="competition.deadlineStatus === 'BeforeDeadline' ? 'positive' : 'warning'"
        />
      </view>
      <text class="card__title">{{ competition.title }}</text>
      <text class="card__eligibility">{{ competition.eligibilitySummary }}</text>
      <view class="card__meta">
        <view>
          <text class="card__meta-label">Registration deadline</text>
          <text class="card__meta-value">{{ deadlineLabel(competition.registrationDeadline) }}</text>
        </view>
        <text class="card__arrow">›</text>
      </view>
    </view>
  </button>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  text-align: left;
  background: #fff;
  border: 1rpx solid #dfe6ee;
  border-radius: 28rpx;
  box-shadow: 0 14rpx 34rpx rgba(24,40,67,.07);
}
.card__cover { position: relative; height: 168rpx; padding: 24rpx; box-sizing: border-box; overflow: hidden; }
.card__cover::after {
  content: '';
  position: absolute;
  width: 190rpx;
  height: 190rpx;
  right: -36rpx;
  bottom: -92rpx;
  border: 28rpx solid rgba(255,255,255,.14);
  border-radius: 50%;
}
.card__cover--cobalt { color: #fff; background: #245ac8; }
.card__cover--amber { color: #291b00; background: #ffc65c; }
.card__cover--forest { color: #fff; background: #19715d; }
.card__category { font-size: 20rpx; font-weight: 800; letter-spacing: 2rpx; text-transform: uppercase; }
.card__number { position: absolute; right: 24rpx; bottom: 2rpx; font-size: 96rpx; font-weight: 900; opacity: .2; }
.card__body { padding: 28rpx; }
.card__status { display: flex; }
.card__title { display: block; margin-top: 20rpx; color: #0a1830; font-size: 31rpx; font-weight: 850; line-height: 1.3; }
.card__eligibility { display: block; margin-top: 12rpx; min-height: 62rpx; color: #657287; font-size: 22rpx; line-height: 1.45; }
.card__meta { display: flex; align-items: flex-end; justify-content: space-between; margin-top: 24rpx; padding-top: 22rpx; border-top: 1rpx solid #e7ecf2; }
.card__meta-label,.card__meta-value { display: block; }
.card__meta-label { color: #8a95a5; font-size: 18rpx; text-transform: uppercase; letter-spacing: 1rpx; }
.card__meta-value { margin-top: 6rpx; color: #243149; font-size: 22rpx; font-weight: 750; }
.card__arrow { color: #245ac8; font-size: 48rpx; line-height: .8; }
</style>
