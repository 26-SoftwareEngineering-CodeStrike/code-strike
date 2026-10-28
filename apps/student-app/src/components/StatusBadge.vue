<script setup lang="ts">
withDefaults(defineProps<{ label: string; tone?: 'positive' | 'warning' | 'danger' | 'neutral' | 'info' }>(), { tone: 'neutral' })
</script>

<template><text class="badge" :class="`badge--${tone}`">{{ label }}</text></template>

<style scoped>
.badge { display: inline-flex; align-items: center; min-height: 24px; padding: 3px 9px; border: 1px solid #dfe4ea; border-radius: 7px; color: #475467; background: #f7f9fb; font-size: 12px; font-weight: 700; line-height: 1.2; }
.badge--positive { color: #126b57; background: #edf8f4; border-color: #cbe9df; }
.badge--warning { color: #855900; background: #fff8e7; border-color: #f1dfae; }
.badge--danger { color: #9d3f3a; background: #fff1ef; border-color: #f2d3cf; }
.badge--info { color: #1e56b3; background: #eef4ff; border-color: #cfddf7; }
</style>
