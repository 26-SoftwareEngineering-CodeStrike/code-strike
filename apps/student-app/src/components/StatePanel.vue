<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    message: string
    actionLabel?: string
    compact?: boolean
  }>(),
  { actionLabel: '', compact: false },
)

defineEmits<{ (event: 'action'): void }>()
</script>

<template>
  <view class="state" :class="{ 'state--compact': compact }">
    <view class="state__signal"><text>CS</text></view>
    <text class="state__title">{{ title }}</text>
    <text class="state__message">{{ message }}</text>
    <button v-if="actionLabel" class="state__action" @click="$emit('action')">
      {{ actionLabel }}
    </button>
  </view>
</template>

<style scoped>
.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56rpx 34rpx;
  text-align: center;
  background: #fff;
  border: 1rpx solid #dfe6ee;
  border-radius: 28rpx;
}
.state--compact { padding: 38rpx 28rpx; }
.state__signal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  color: #0a1830;
  background: #d9ff74;
  border-radius: 22rpx;
  font-size: 20rpx;
  font-weight: 900;
}
.state__title { margin-top: 24rpx; color: #101d32; font-size: 29rpx; font-weight: 800; }
.state__message { margin-top: 12rpx; color: #69768a; font-size: 23rpx; line-height: 1.55; }
.state__action {
  margin: 28rpx 0 0;
  padding: 18rpx 28rpx;
  color: #fff;
  background: #0a1830;
  border-radius: 16rpx;
  font-size: 23rpx;
  font-weight: 800;
  line-height: 1.2;
}
</style>
