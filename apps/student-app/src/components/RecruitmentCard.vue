<script setup lang="ts">
import type { RecruitmentSummary } from '@codestrike/contracts'
import StatusBadge from './StatusBadge.vue'

const props = defineProps<{ recruitment: RecruitmentSummary }>()
defineEmits<{ (event: 'open', id: string): void }>()

function availabilityLabel() {
  const labels: Record<RecruitmentSummary['availability'], string> = {
    Open: 'OPEN',
    Full: 'FULL',
    ManuallyClosed: 'MANUALLY CLOSED',
    RegistrationClosed: 'REGISTRATION CLOSED',
    Delisted: 'DELISTED',
  }
  return labels[props.recruitment.availability]
}

function availabilityTone(): 'positive' | 'warning' | 'danger' | 'neutral' {
  if (props.recruitment.availability === 'Open') return 'positive'
  if (props.recruitment.availability === 'Full') return 'danger'
  return 'warning'
}
</script>

<template>
  <button class="recruitment" @click="$emit('open', recruitment.id)">
    <view class="recruitment__rail">
      <StatusBadge :label="availabilityLabel()" :tone="availabilityTone()" />
      <StatusBadge
        :label="recruitment.matchStatus === 'Matched' ? 'SKILL MATCHED' : 'NOT MATCHED'"
        :tone="recruitment.matchStatus === 'Matched' ? 'info' : 'neutral'"
      />
    </view>
    <text class="recruitment__name">{{ recruitment.name }}</text>
    <text class="recruitment__summary">{{ recruitment.summary }}</text>
    <view class="recruitment__skills">
      <text v-for="skill in recruitment.requiredSkills" :key="skill" class="skill">{{ skill }}</text>
    </view>
    <view class="recruitment__footer">
      <view>
        <text class="recruitment__capacity">{{ recruitment.memberCount }}/{{ recruitment.capacity }} members</text>
        <text class="recruitment__captain">Captain @{{ recruitment.captainUsername }}</text>
      </view>
      <text class="recruitment__arrow">›</text>
    </view>
  </button>
</template>

<style scoped>
.recruitment {
  width: 100%;
  margin: 0;
  padding: 28rpx;
  text-align: left;
  background: #fff;
  border: 1rpx solid #dfe6ee;
  border-radius: 26rpx;
  box-shadow: 0 12rpx 30rpx rgba(24,40,67,.06);
}
.recruitment__rail { display: flex; flex-wrap: wrap; gap: 10rpx; }
.recruitment__name { display: block; margin-top: 22rpx; color: #0a1830; font-size: 31rpx; font-weight: 850; }
.recruitment__summary { display: block; margin-top: 12rpx; color: #667388; font-size: 22rpx; line-height: 1.55; }
.recruitment__skills { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 22rpx; }
.skill { padding: 9rpx 14rpx; color: #34435a; background: #f0f4f8; border-radius: 12rpx; font-size: 19rpx; font-weight: 700; }
.recruitment__footer { display: flex; align-items: flex-end; justify-content: space-between; margin-top: 24rpx; padding-top: 20rpx; border-top: 1rpx solid #e7ecf2; }
.recruitment__capacity,.recruitment__captain { display: block; }
.recruitment__capacity { color: #223149; font-size: 22rpx; font-weight: 800; }
.recruitment__captain { margin-top: 5rpx; color: #8a95a5; font-size: 19rpx; }
.recruitment__arrow { color: #245ac8; font-size: 48rpx; line-height: .8; }
</style>
