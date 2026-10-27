<script setup lang="ts">
defineProps<{ active: 'Competitions' | 'Teams' | 'Planner' | 'Me' }>()

const items = ['Competitions', 'Teams', 'Planner', 'Me'] as const

function openItem(item: (typeof items)[number]) {
  if (item === 'Competitions') {
    uni.reLaunch({ url: '/pages/index/index' })
    return
  }
  uni.showToast({ title: `${item} is planned for a later wave`, icon: 'none' })
}
</script>

<template>
  <view class="nav-wrap">
    <view class="nav">
      <button
        v-for="item in items"
        :key="item"
        class="nav__item"
        :class="{ 'nav__item--active': active === item }"
        @click="openItem(item)"
      >
        <text class="nav__dot" />
        <text>{{ item }}</text>
      </button>
    </view>
  </view>
</template>

<style scoped>
.nav-wrap {
  position: fixed;
  z-index: 20;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 0 20rpx 20rpx;
  pointer-events: none;
}
.nav {
  display: flex;
  max-width: 760px;
  margin: 0 auto;
  padding: 12rpx;
  background: rgba(255,255,255,.97);
  border: 1rpx solid #dce4ef;
  border-radius: 26rpx;
  box-shadow: 0 18rpx 50rpx rgba(10,24,48,.18);
  pointer-events: auto;
}
.nav__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  margin: 0;
  padding: 13rpx 4rpx;
  color: #7b879a;
  background: transparent;
  border-radius: 18rpx;
  font-size: 19rpx;
  line-height: 1.2;
}
.nav__item--active { color: #0a1830; background: #eff4f9; font-weight: 800; }
.nav__dot { width: 10rpx; height: 10rpx; border-radius: 50%; background: #c3ccd8; }
.nav__item--active .nav__dot { background: #5fddc4; box-shadow: 0 0 0 7rpx rgba(95,221,196,.17); }
</style>
