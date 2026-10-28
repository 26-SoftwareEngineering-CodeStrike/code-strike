<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PrototypeActor } from '@codestrike/contracts'

const props = withDefaults(defineProps<{ actors: PrototypeActor[]; selectedId: string; compact?: boolean; overlay?: boolean; open?: boolean }>(), { compact: false, overlay: false, open: false })
const emit = defineEmits<{ (event: 'select', actorId: string): void; (event: 'close'): void }>()
const expanded = ref(false)
const selectedLabel = computed(() => props.actors.find((actor) => actor.id === props.selectedId)?.label || 'Select a demo actor')
</script>

<template>
  <view v-if="overlay" v-show="open" class="persona-overlay">
    <button class="persona-overlay__backdrop" aria-label="Close Prototype Lab" @click="emit('close')" />
    <view class="persona persona--sheet" role="dialog" aria-label="Prototype Lab">
      <view class="persona__sheet-head"><view><text class="persona__label">Prototype Lab</text><text class="persona__selected">Demo actor: {{ selectedLabel }}</text></view><button class="persona__close" aria-label="Close Prototype Lab" @click="emit('close')">×</button></view>
      <slot name="tools" />
      <scroll-view class="persona__scroll" scroll-x :show-scrollbar="false"><view class="persona__items"><button v-for="actor in actors" :key="actor.id" class="persona__button" :class="{ 'persona__button--active': selectedId === actor.id }" @click="emit('select', actor.id)">{{ actor.label }}</button></view></scroll-view>
      <text class="persona__note">Demo actors switch local Mock state only. This is not authentication or server authorization.</text>
    </view>
  </view>
  <view v-else class="persona" :class="{ 'persona--compact': compact }">
    <button class="persona__trigger" :aria-expanded="expanded" @click="expanded = !expanded"><view><text class="persona__label">Prototype Lab</text><text class="persona__selected">Demo actor: {{ selectedLabel }}</text></view><text class="persona__chevron">{{ expanded ? '−' : '+' }}</text></button>
    <view v-show="expanded" class="persona__body"><slot name="tools" /><scroll-view class="persona__scroll" scroll-x :show-scrollbar="false"><view class="persona__items"><button v-for="actor in actors" :key="actor.id" class="persona__button" :class="{ 'persona__button--active': selectedId === actor.id }" @click="emit('select', actor.id)">{{ actor.label }}</button></view></scroll-view><text class="persona__note">Demo actors switch local Mock state only. This is not authentication or server authorization.</text></view>
  </view>
</template>

<style scoped>
.persona { overflow: hidden; background: #fff; border: 1px dashed #bdc7d5; border-radius: 14px; }.persona__trigger { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 52px; margin: 0; padding: 9px 14px; text-align: left; color: #344054; background: #f7f9fb; border-radius: 0; }.persona__label,.persona__selected,.persona__note { display: block; }.persona__label { color: #14213d; font-size: 16px; font-weight: 750; }.persona__selected { margin-top: 2px; color: #667085; font-size: 13px; }.persona__chevron { color: #2563eb; font-size: 22px; }.persona__body { padding: 4px 0 14px; border-top: 1px dashed #d7dde5; }
.persona-overlay { position: fixed; z-index: 40; inset: 0; display: flex; align-items: flex-end; justify-content: center; }.persona-overlay__backdrop { position: absolute; inset: 0; width: 100%; height: 100%; min-height: 100%; margin: 0; padding: 0; background: rgba(20,33,61,.42); border-radius: 0; }.persona--sheet { position: relative; width: 100%; max-width: 720px; max-height: 76vh; padding: 18px 0 calc(18px + constant(safe-area-inset-bottom)); padding-bottom: calc(18px + env(safe-area-inset-bottom)); overflow: auto; border: 0; border-radius: 20px 20px 0 0; box-shadow: 0 -12px 36px rgba(20,33,61,.16); }.persona__sheet-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 18px 12px; }.persona__close { width: 44px; height: 44px; min-height: 44px; margin: 0; padding: 0; color: #475467; background: #eef3f8; border-radius: 12px; font-size: 24px; line-height: 44px; }
.persona__scroll { margin-top: 10px; white-space: nowrap; }.persona__items { display: inline-flex; gap: 8px; padding: 0 18px; }.persona__button { min-height: 44px; margin: 0; padding: 0 14px; color: #475467; background: #fff; border: 1px solid #dfe4ea; border-radius: 11px; font-size: 14px; line-height: 1.2; }.persona__button--active { color: #fff; background: #2563eb; border-color: #2563eb; font-weight: 700; }.persona__note { margin-top: 12px; padding: 0 18px; color: #667085; font-size: 13px; line-height: 1.45; }.persona--compact .persona__note { display: none; }
</style>
