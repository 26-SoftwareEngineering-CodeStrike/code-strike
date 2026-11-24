<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { createStudentApiClient } from '../../api/client'
import { choosePostImages } from '../../api/community-images'
import { postPayload } from '../../api/community'
import { toStatePanel } from '../../api/error-presentation'
import CsHeader from '../../components/CsHeader.vue'
import StatePanel from '../../components/StatePanel.vue'

const api = createStudentApiClient()
const competitionId = ref('')
const postId = ref('')
const text = ref('')
const links = ref('')
const images = ref<string[]>([])
const loading = ref(true)
const busy = ref(false)
const ready = ref(false)
const error = ref('')
const needsProfile = ref(false)

onLoad(options => {
  competitionId.value = String(options?.competitionId || '')
  postId.value = String(options?.id || '')
  load()
})
async function load() {
  loading.value = true
  ready.value = false
  error.value = ''
  try {
    if (!api.community || (await api.restoreSession())?.role !== 'Student') throw new Error('Sign in with a student account to write a post.')
    if (postId.value) {
      const post = await api.community.latestPost(postId.value)
      const previews = await Promise.all(post.imageIds.map(id => api.community!.image(id)))
      text.value = post.text
      links.value = post.links.join('\n')
      images.value = previews
      competitionId.value = post.competitionId
    }
    if (!competitionId.value) throw new Error('Open the editor from a competition discussion.')
    ready.value = true
  } catch (reason) {
    error.value = toStatePanel(reason).message
  } finally { loading.value = false }
}
async function attach() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try { images.value.push(...await choosePostImages(9 - images.value.length)) }
  catch (reason) { error.value = toStatePanel(reason).message }
  finally { busy.value = false }
}
function preview(current: string) {
  uni.previewImage({ current, urls: images.value, fail: () => { error.value = 'Could not preview this image.' } })
}
function openProfile() { uni.navigateTo({url: '/pages/profile/index'}) }
async function save() {
  if (busy.value || !ready.value || !api.community) return
  busy.value = true
  error.value = ''
  needsProfile.value = false
  try {
    const body = postPayload(text.value, links.value, images.value)
    const post = postId.value
      ? await api.community.editPost(postId.value, body)
      : await api.community.createPost(competitionId.value, body)
    uni.redirectTo({url: '/pages/community/post?version=mine&id=' + encodeURIComponent(post.id)})
  } catch (reason) {
    error.value = toStatePanel(reason).message
    needsProfile.value = (reason as {code?: string})?.code === 'PROFILE_INCOMPLETE'
  } finally { busy.value = false }
}
</script>

<template>
  <view class="page-shell">
    <CsHeader back eyebrow="Competition discussion" :title="postId ? 'Edit post' : 'Write a post'" />
    <view class="cm-page cm-stack">
      <StatePanel v-if="loading" title="Loading editor" message="Preparing your post and its attachments." />
      <StatePanel v-else-if="!ready" title="Editor unavailable" :message="error" action-label="Try again" @action="load" />
      <view v-else class="cm-card">
        <label class="cm-label">Post text<textarea v-model="text" class="cm-textarea" :maxlength="20000" placeholder="Share a question or competition experience" /></label>
        <label class="cm-label">Links<textarea v-model="links" class="cm-textarea" :maxlength="-1" placeholder="One HTTP or HTTPS link per line" /></label>
        <text class="cm-label">Images ({{ images.length }}/9)</text>
        <view v-for="(url, index) in images" :key="index" class="cm-stack">
          <button class="cm-image-button" :aria-label="'Preview image ' + (index + 1)" @click="preview(url)"><image class="cm-preview" mode="aspectFit" :src="url" /></button>
          <button class="cm-action" :disabled="busy" @click="images.splice(index, 1)">Remove image {{ index + 1 }}</button>
        </view>
        <button v-if="images.length < 9" :disabled="busy" class="cm-action" @click="attach">Add images</button>
        <text class="cm-meta">JPEG or PNG, up to 5 MiB each. Posts and edits are reviewed before publication.</text>
        <text v-if="error" class="cm-error" role="alert">{{ error }}</text>
        <button v-if="needsProfile" class="cm-action" @click="openProfile">Complete profile</button>
        <button class="cm-primary" :disabled="busy" @click="save">{{ busy ? 'Working…' : 'Submit for review' }}</button>
      </view>
    </view>
  </view>
</template>
<style src="../../styles/community.css"></style>
