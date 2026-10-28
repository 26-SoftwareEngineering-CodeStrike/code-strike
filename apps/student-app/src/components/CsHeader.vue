<script setup lang="ts">
const props = defineProps<{ title: string; eyebrow?: string; back?: boolean; demo?: boolean }>()
const emit = defineEmits<{ (event: 'demo'): void }>()

function goBack() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/index/index' }) })
}

function useHeaderTool() {
  if (props.demo) emit('demo')
  else uni.showToast({ title: 'No new notifications', icon: 'none' })
}
</script>

<template>
  <view class="header">
    <view class="header__rail">
      <button v-if="back" class="header__icon" aria-label="Go back" @click="goBack"><text class="header__back">‹</text></button>
      <view v-else class="header__mark"><text>CS</text></view>
      <view class="header__copy">
        <text v-if="eyebrow" class="header__eyebrow">{{ eyebrow }}</text>
        <text class="header__title">{{ title }}</text>
      </view>
      <button class="header__icon" :class="{ header__demo: demo }" :aria-label="demo ? 'Open Prototype Lab' : 'Notifications'" @click="useHeaderTool">
        <view v-if="demo" class="header__sliders" aria-hidden="true"><view /><view /><view /></view>
        <view v-else class="header__notification" aria-hidden="true"><view class="header__notification-dot" /></view>
      </button>
    </view>
  </view>
</template>

<style scoped>
.header { padding: 14px 16px 12px; color: #14213d; background: rgba(255,255,255,.96); border-bottom: 1px solid #dfe4ea; }
.header__rail { display: flex; align-items: center; gap: 12px; max-width: 980px; margin: 0 auto; }
.header__copy { flex: 1; min-width: 0; }
.header__mark,.header__icon { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; min-height: 44px; margin: 0; padding: 0; border: 1px solid #dfe4ea; border-radius: 12px; color: #344054; background: #f7f9fb; line-height: 1; }
.header__mark { color: #14213d; background: #c9f43d; border-color: #c9f43d; font-size: 13px; font-weight: 800; letter-spacing: .04em; }
.header__back { color: #344054; font-size: 28px; line-height: 1; transform: translateY(-1px); }
.header__demo { color: #2563eb; background: #f2f6fd; }
.header__sliders { position: relative; width: 21px; height: 18px; }
.header__sliders > view { position: absolute; left: 1px; width: 19px; height: 2px; background: currentColor; border-radius: 2px; }
.header__sliders > view:nth-child(1) { top: 2px; }.header__sliders > view:nth-child(2) { top: 8px; }.header__sliders > view:nth-child(3) { top: 14px; }
.header__sliders > view::after { content: ''; position: absolute; top: -2px; width: 6px; height: 6px; background: #fff; border: 2px solid currentColor; border-radius: 50%; }
.header__sliders > view:nth-child(1)::after,.header__sliders > view:nth-child(3)::after { left: 3px; }.header__sliders > view:nth-child(2)::after { right: 3px; }
.header__notification { position: relative; width: 17px; height: 18px; border: 2px solid currentColor; border-top-left-radius: 9px; border-top-right-radius: 9px; border-bottom: 0; }
.header__notification::after { content: ''; position: absolute; right: -4px; bottom: -3px; left: -4px; height: 2px; background: currentColor; border-radius: 2px; }
.header__notification-dot { position: absolute; top: -5px; right: -5px; width: 6px; height: 6px; background: #2563eb; border: 2px solid #f7f9fb; border-radius: 50%; }
.header__eyebrow { display: block; overflow: hidden; color: #667085; font-size: 12px; font-weight: 650; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
.header__title { display: block; margin-top: 3px; overflow: hidden; color: #14213d; font-size: 22px; font-weight: 750; line-height: 1.18; letter-spacing: -.02em; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 340px) { .header { padding-right: 12px; padding-left: 12px; }.header__rail { gap: 9px; }.header__title { font-size: 20px; } }
</style>
