<script setup lang="ts">
import { ref, watch } from 'vue'
import { createStudentApiClient } from '../api/client'
import { toStatePanel } from '../api/error-presentation'

const props = defineProps<{imageId: string; position: number}>()
const api = createStudentApiClient()
const src = ref('')
const error = ref('')
const loading = ref(true)
async function load() {
  const id = props.imageId
  src.value = ''
  error.value = ''
  loading.value = true
  try {
    const data = await api.community!.image(id)
    if (id === props.imageId) src.value = data
  } catch (reason) {
    if (id === props.imageId) error.value = toStatePanel(reason).message
  } finally {
    if (id === props.imageId) loading.value = false
  }
}
function failed() {
  src.value = ''
  error.value = 'The image could not be displayed.'
}
function preview() {
  uni.previewImage({ current: src.value, urls: [src.value], fail: failed })
}
watch(() => props.imageId, load, {immediate: true})
</script>
<template>
  <view class="cm-stack">
    <text v-if="loading" class="cm-meta">Loading image {{ position }}…</text>
    <template v-else-if="error">
      <text class="cm-error" role="alert">Image {{ position }} unavailable. {{ error }}</text>
      <button class="cm-action" @click="load">Retry image</button>
    </template>
    <button v-else-if="src" class="cm-image-button" :aria-label="'Preview image ' + position" @click="preview">
      <image class="cm-preview" mode="aspectFit" :src="src" @error="failed" />
    </button>
  </view>
</template>
<style src="../styles/community.css"></style>
