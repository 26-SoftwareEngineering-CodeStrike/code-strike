<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    tone?: 'positive' | 'warning' | 'danger' | 'neutral' | 'info'
  }>(),
  { tone: 'neutral' },
)
</script>

<template>
  <text class="badge" :class="`badge--${tone}`">{{ label }}</text>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  padding: 9rpx 14rpx;
  border-radius: 999rpx;
  color: #465369;
  background: #edf1f5;
  font-size: 19rpx;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: .5rpx;
}
.badge--positive { color: #0d684f; background: #dbf8ef; }
.badge--warning { color: #7c5400; background: #fff0c7; }
.badge--danger { color: #9b3d35; background: #ffe4df; }
.badge--info { color: #245c9d; background: #e4f0ff; }
</style>
