<script setup lang="ts">
defineProps<{ active: 'Competitions' | 'Teams' | 'Planner' | 'Me' }>()

const items = [
  { label: 'Competitions', icon: 'discover' },
  { label: 'Teams', icon: 'teams' },
  { label: 'Planner', icon: 'planner' },
  { label: 'Me', icon: 'profile' },
] as const

function openItem(item: (typeof items)[number]['label']) {
  if (item === 'Competitions') return uni.reLaunch({ url: '/pages/index/index' })
  if (item === 'Teams') return uni.reLaunch({ url: '/pages/teams/index' })
  if (item === 'Planner') return uni.reLaunch({ url: '/pages/planner/index' })
  uni.showToast({ title: `${item} is planned for a later wave`, icon: 'none' })
}
</script>

<template>
  <view class="nav-wrap">
    <view class="nav" role="navigation" aria-label="Primary navigation">
      <button v-for="item in items" :key="item.label" class="nav__item" :class="{ 'nav__item--active': active === item.label }" :aria-label="item.label" @click="openItem(item.label)">
        <view class="nav__icon" :class="`nav__icon--${item.icon}`" aria-hidden="true">
          <template v-if="item.icon === 'discover'"><view class="discover__ring"><view class="discover__needle" /></view></template>
          <template v-else-if="item.icon === 'teams'"><view class="teams__head teams__head--one" /><view class="teams__head teams__head--two" /><view class="teams__body" /></template>
          <template v-else-if="item.icon === 'planner'"><view class="planner__frame"><view class="planner__top" /><view class="planner__dot planner__dot--one" /><view class="planner__dot planner__dot--two" /></view></template>
          <template v-else><view class="profile__head" /><view class="profile__body" /></template>
        </view>
        <text class="nav__label">{{ item.label }}</text>
      </button>
    </view>
  </view>
</template>

<style scoped>
.nav-wrap { position: fixed; z-index: 20; right: 0; bottom: 0; left: 0; padding: 0 10px calc(10px + constant(safe-area-inset-bottom)); padding-bottom: calc(10px + env(safe-area-inset-bottom)); pointer-events: none; }
.nav { display: flex; max-width: 720px; margin: 0 auto; padding: 5px; background: rgba(255,255,255,.98); border: 1px solid #dfe4ea; border-radius: 18px; box-shadow: 0 8px 28px rgba(20,33,61,.12); pointer-events: auto; }
.nav__item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 0; min-height: 52px; margin: 0; padding: 4px 2px 3px; color: #7a8495; background: transparent; border-radius: 13px; font-size: 11px; line-height: 1.2; }
.nav__item--active { color: #14213d; background: #eef3f8; font-weight: 750; }
.nav__icon { position: relative; width: 28px; height: 27px; color: currentColor; border-radius: 9px; }
.nav__item--active .nav__icon { color: #14213d; background: #c9f43d; }
.discover__ring { position: absolute; inset: 4px 5px 5px 4px; border: 2px solid currentColor; border-radius: 50%; }.discover__needle { position: absolute; right: -5px; bottom: -3px; width: 8px; height: 2px; background: currentColor; border-radius: 2px; transform: rotate(45deg); transform-origin: center; }
.nav__icon--teams .teams__head { position: absolute; top: 5px; width: 7px; height: 7px; border: 2px solid currentColor; border-radius: 50%; }.teams__head--one { left: 5px; }.teams__head--two { right: 5px; }.teams__body { position: absolute; right: 4px; bottom: 4px; left: 4px; height: 8px; border: 2px solid currentColor; border-bottom: 0; border-radius: 9px 9px 0 0; }
.planner__frame { position: absolute; inset: 3px; border: 2px solid currentColor; border-radius: 5px; }.planner__top { position: absolute; top: 4px; right: 0; left: 0; border-top: 2px solid currentColor; }.planner__dot { position: absolute; top: 10px; width: 3px; height: 3px; background: currentColor; border-radius: 1px; }.planner__dot--one { left: 4px; }.planner__dot--two { right: 4px; }
.profile__head { position: absolute; top: 4px; left: 9px; width: 9px; height: 9px; border: 2px solid currentColor; border-radius: 50%; }.profile__body { position: absolute; right: 5px; bottom: 4px; left: 5px; height: 9px; border: 2px solid currentColor; border-bottom: 0; border-radius: 10px 10px 0 0; }
.nav__label { overflow: hidden; max-width: 100%; text-overflow: ellipsis; white-space: nowrap; }
</style>
