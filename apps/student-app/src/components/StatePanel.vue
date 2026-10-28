<script setup lang="ts">
withDefaults(defineProps<{ title: string; message: string; actionLabel?: string; compact?: boolean }>(), { actionLabel: '', compact: false })
defineEmits<{ (event: 'action'): void }>()
</script>

<template>
  <view class="state" :class="{ 'state--compact': compact }">
    <view class="state__signal"><text>CS</text></view>
    <view class="state__copy"><text class="state__title">{{ title }}</text><text class="state__message">{{ message }}</text></view>
    <button v-if="actionLabel" class="state__action" @click="$emit('action')">{{ actionLabel }}</button>
  </view>
</template>

<style scoped>
.state { display: flex; flex-direction: column; align-items: flex-start; padding: 28px 22px; background: #fff; border: 1px solid #dfe4ea; border-radius: 18px; }
.state--compact { display: grid; grid-template-columns: 42px 1fr; gap: 12px; padding: 18px; }
.state__signal { display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; flex: 0 0 auto; color: #14213d; background: #c9f43d; border-radius: 12px; font-size: 12px; font-weight: 800; }
.state__copy { min-width: 0; }
.state__title { display: block; margin-top: 15px; color: #14213d; font-size: 18px; font-weight: 750; line-height: 1.3; }
.state--compact .state__title { margin-top: 0; font-size: 16px; }
.state__message { display: block; margin-top: 7px; color: #667085; font-size: 15px; line-height: 1.5; }
.state__action { min-height: 44px; margin: 20px 0 0; padding: 0 18px; color: #fff; background: #2563eb; border-radius: 12px; font-size: 15px; font-weight: 700; line-height: 1.2; }
.state--compact .state__action { grid-column: 2; justify-self: start; margin-top: 4px; }
</style>
