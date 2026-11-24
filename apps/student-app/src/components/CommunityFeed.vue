<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { createStudentApiClient } from '../api/client'
import { toStatePanel } from '../api/error-presentation'
import type { CommunityPostDto } from '@codestrike/contracts'
import StatePanel from './StatePanel.vue'

const props = defineProps<{competitionId: string; refresh: number}>()
const api = createStudentApiClient()
const published = ref<CommunityPostDto[]>([])
const personal = ref<CommunityPostDto[]>([])
const student = ref(false)
const loading = ref(true)
const error = ref('')
let generation = 0
const sections = computed(() => [
  { label: 'Your posts in review', rows: personal.value, own: true },
  { label: 'Published posts', rows: published.value, own: false },
].filter(section => section.rows.length))

async function load() {
  const request = ++generation
  loading.value = true
  error.value = ''
  try {
    const user = await api.restoreSession()
    const signedIn = user?.role === 'Student'
    const feed = await api.community!.feed(props.competitionId, signedIn)
    if (request !== generation) return
    student.value = signedIn
    personal.value = feed.personal
    published.value = feed.published
  } catch (reason) {
    if (request === generation) error.value = toStatePanel(reason).message
  } finally {
    if (request === generation) loading.value = false
  }
}
watch(() => [props.competitionId, props.refresh], load, {immediate: true})
function openPost(post: CommunityPostDto, own: boolean) {
  uni.navigateTo({url: `/pages/community/post?id=${encodeURIComponent(post.id)}&version=${own ? 'mine' : 'public'}`})
}
function compose() {
  uni.navigateTo({url: student.value
    ? '/pages/community/editor?competitionId=' + encodeURIComponent(props.competitionId)
    : '/pages/auth/login'})
}
</script>

<template>
  <view class="cm-stack">
    <StatePanel v-if="loading" compact title="Loading discussion" message="Getting posts for this competition." />
    <StatePanel v-else-if="error" compact title="Discussion unavailable" :message="error" action-label="Try again" @action="load" />
    <template v-else>
      <button class="cm-primary" @click="compose">{{ student ? 'Write a post' : 'Sign in to write a post' }}</button>
      <view v-for="section in sections" :key="section.label" class="cm-stack">
        <text class="cm-heading">{{ section.label }}</text>
        <button v-for="post in section.rows" :key="post.revisionId" class="cm-card cm-post-link" @click="openPost(post, section.own)">
          <text class="cm-meta">{{ post.username }} · {{ post.createdAt.slice(0, 10) }} · {{ post.status }}</text>
          <text class="cm-body cm-excerpt">{{ post.text || post.links[0] || 'Image post' }}</text>
          <text class="cm-meta">{{ post.imageIds.length ? post.imageIds.length + ' images · ' : '' }}{{ post.likes }} likes · {{ post.favorites }} favorites</text>
        </button>
      </view>
      <StatePanel v-if="!published.length" compact title="No published posts yet" message="Posts appear here when their review is complete." />
    </template>
  </view>
</template>
<style src="../styles/community.css"></style>
