<script setup lang="ts">
import type { RecruitmentSummary } from '@codestrike/contracts'
import StatusBadge from './StatusBadge.vue'
const props = defineProps<{ recruitment: RecruitmentSummary }>()
defineEmits<{ (event: 'open', id: string): void }>()
function availabilityLabel() { return ({ Open: 'Open', Full: 'Full', ManuallyClosed: 'Closed', RegistrationClosed: 'Registration closed', Delisted: 'Delisted' } as const)[props.recruitment.availability] }
function availabilityTone(): 'positive' | 'warning' | 'danger' | 'neutral' { if (props.recruitment.availability === 'Open') return 'positive'; if (props.recruitment.availability === 'Full') return 'danger'; return 'warning' }
</script>

<template>
  <button class="recruitment" @click="$emit('open', recruitment.id)">
    <view class="recruitment__rail"><StatusBadge :label="availabilityLabel()" :tone="availabilityTone()" /><text class="recruitment__match">{{ recruitment.matchStatus === 'Matched' ? 'Skills overlap' : 'No skill overlap' }}</text></view>
    <text class="recruitment__name">{{ recruitment.name }}</text><text class="recruitment__summary">{{ recruitment.summary }}</text>
    <view class="recruitment__skills"><text v-for="skill in recruitment.requiredSkills" :key="skill" class="skill">{{ skill }}</text></view>
    <view class="recruitment__footer"><view><text class="recruitment__capacity">{{ recruitment.memberCount }}/{{ recruitment.capacity }} members</text><text class="recruitment__captain">Captain @{{ recruitment.captainUsername }}</text></view><text class="recruitment__arrow">›</text></view>
  </button>
</template>

<style scoped>
.recruitment { width: 100%; min-height: 0; margin: 0; padding: 18px; text-align: left; background: #fff; border: 1px solid #dfe4ea; border-radius: 16px; }
.recruitment__rail { display: flex; align-items: center; justify-content: space-between; gap: 10px; }.recruitment__match { color: #667085; font-size: 13px; }
.recruitment__name { display: block; margin-top: 13px; color: #14213d; font-size: 19px; font-weight: 750; }.recruitment__summary { display: block; margin-top: 7px; color: #667085; font-size: 15px; line-height: 1.5; }
.recruitment__skills { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 13px; }.skill { padding: 4px 8px; color: #344054; background: #eef3f8; border-radius: 7px; font-size: 13px; font-weight: 650; }
.recruitment__footer { display: flex; align-items: flex-end; justify-content: space-between; margin-top: 15px; padding-top: 13px; border-top: 1px solid #e7ebf0; }.recruitment__capacity,.recruitment__captain { display: block; }.recruitment__capacity { color: #344054; font-size: 14px; font-weight: 700; }.recruitment__captain { margin-top: 2px; color: #8993a4; font-size: 13px; }.recruitment__arrow { color: #2563eb; font-size: 28px; line-height: 1; }
</style>
