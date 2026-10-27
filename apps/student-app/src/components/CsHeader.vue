<script setup lang="ts">
defineProps<{
  title: string
  eyebrow?: string
  back?: boolean
}>()

function goBack() {
  uni.navigateBack({
    fail: () => uni.reLaunch({ url: '/pages/index/index' }),
  })
}

function showNotifications() {
  uni.showToast({ title: 'Notifications arrive in Wave 2', icon: 'none' })
}
</script>

<template>
  <view class="header">
    <view class="header__rail">
      <button v-if="back" class="header__icon" aria-label="Go back" @click="goBack">
        <text>‹</text>
      </button>
      <view v-else class="header__mark"><text>CS</text></view>
      <button class="header__icon" aria-label="Notifications" @click="showNotifications">
        <text class="header__bell">●</text>
      </button>
    </view>
    <text v-if="eyebrow" class="header__eyebrow">{{ eyebrow }}</text>
    <text class="header__title">{{ title }}</text>
  </view>
</template>

<style scoped>
.header {
  padding: 28rpx 30rpx 34rpx;
  color: #f8fbff;
  background: #0a1830;
  border-radius: 0 0 34rpx 34rpx;
}
.header__rail { display: flex; align-items: center; justify-content: space-between; }
.header__mark,
.header__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 68rpx;
  height: 68rpx;
  margin: 0;
  padding: 0;
  border: 1rpx solid rgba(255,255,255,.16);
  border-radius: 20rpx;
  color: #fff;
  background: rgba(255,255,255,.08);
  font-size: 38rpx;
  line-height: 1;
}
.header__mark {
  color: #0a1830;
  background: #d9ff74;
  border-color: #d9ff74;
  font-size: 22rpx;
  font-weight: 900;
  letter-spacing: 1rpx;
}
.header__bell { color: #ff8a72; font-size: 26rpx; }
.header__eyebrow {
  display: block;
  margin-top: 44rpx;
  color: #9eb0ca;
  font-size: 20rpx;
  font-weight: 700;
  letter-spacing: 3rpx;
}
.header__title {
  display: block;
  margin-top: 14rpx;
  max-width: 620rpx;
  font-size: 52rpx;
  font-weight: 800;
  line-height: 1.12;
  letter-spacing: -1rpx;
}
</style>
