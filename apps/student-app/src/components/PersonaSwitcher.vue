<script setup lang="ts">
import type { PrototypeActor } from '@codestrike/contracts'

defineProps<{
  actors: PrototypeActor[]
  selectedId: string
  compact?: boolean
}>()

const emit = defineEmits<{ (event: 'select', actorId: string): void }>()
</script>

<template>
  <view class="persona" :class="{ 'persona--compact': compact }">
    <text class="persona__label">PROTOTYPE PERSONA · MOCK ONLY</text>
    <scroll-view class="persona__scroll" scroll-x :show-scrollbar="false">
      <view class="persona__items">
        <button
          v-for="actor in actors"
          :key="actor.id"
          class="persona__button"
          :class="{ 'persona__button--active': selectedId === actor.id }"
          @click="emit('select', actor.id)"
        >
          {{ actor.label }}
        </button>
      </view>
    </scroll-view>
    <text class="persona__note">This selector simulates UI roles. It is not authentication or server authorization.</text>
  </view>
</template>

<style scoped>
.persona { padding: 24rpx 0 22rpx; color: #dce6f5; background: #13233e; border-radius: 24rpx; }
.persona__label,.persona__note { display: block; padding: 0 24rpx; }
.persona__label { color: #d9ff74; font-size: 20rpx; font-weight: 900; letter-spacing: 1.5rpx; }
.persona__scroll { margin-top: 18rpx; white-space: nowrap; }
.persona__items { display: inline-flex; gap: 10rpx; padding: 0 24rpx; }
.persona__button { margin: 0; padding: 16rpx 19rpx; color: #c8d4e5; background: rgba(255,255,255,.08); border: 1rpx solid rgba(255,255,255,.13); border-radius: 999rpx; font-size: 21rpx; line-height: 1.15; }
.persona__button--active { color: #0a1830; background: #fff; border-color: #fff; font-weight: 850; }
.persona__note { margin-top: 17rpx; color: #aebcd0; font-size: 20rpx; line-height: 1.45; }
.persona--compact .persona__note { display: none; }
</style>
