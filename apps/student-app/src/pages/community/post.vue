<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app'
import { computed, nextTick, ref } from 'vue'
import type { CommunityCommentDto, CommunityPostDto, PostInteractionKind, PostInteractionsDto, UserDto } from '@codestrike/contracts'
import { createStudentApiClient } from '../../api/client'
import { ownsContent } from '../../api/community'
import { toStatePanel } from '../../api/error-presentation'
import CsHeader from '../../components/CsHeader.vue'
import CsBottomNav from '../../components/CsBottomNav.vue'
import StatePanel from '../../components/StatePanel.vue'
import CommunityImage from '../../components/CommunityImage.vue'

const api = createStudentApiClient()
const postId = ref('')
const ownVersion = ref(false)
const viewer = ref<UserDto | null>(null)
const post = ref<CommunityPostDto | null>(null)
const comments = ref<CommunityCommentDto[]>([])
const receipts = ref<CommunityCommentDto[]>([])
const interactions = ref<PostInteractionsDto | null>(null)
const loading = ref(true)
const busy = ref(false)
const loadError = ref('')
const error = ref('')
const notice = ref('')
const text = ref('')
const editing = ref<CommunityCommentDto | null>(null)
const replying = ref<CommunityCommentDto | null>(null)
const isStudent = computed(() => viewer.value?.role === 'Student')
const visibleComments = computed(() => {
  const rows = new Map(comments.value.map(row => [row.id, row]))
  for (const row of receipts.value) rows.set(row.id, row)
  return Array.from(rows.values())
})
const parents = computed(() => new Map(comments.value.map(row => [row.id, row])))
const discussionUrl = computed(() => '/pages/competition/detail?tab=Discussion&id=' + encodeURIComponent(post.value?.competitionId || ''))
onLoad(options => {
  postId.value = String(options?.id || '')
  ownVersion.value = options?.version === 'mine'
})
onShow(() => load())
async function load() {
  loading.value = true
  loadError.value = ''
  try {
    if (!api.community || !postId.value) throw new Error('Open a post from its competition discussion.')
    const user = await api.restoreSession()
    if (viewer.value?.id !== user?.id) { receipts.value = []; resetComposer() }
    viewer.value = user
    const thread = await api.community.thread(postId.value, ownVersion.value, isStudent.value)
    post.value = thread.post
    comments.value = thread.comments
    interactions.value = thread.interactions
    const publicRevisions = new Set(thread.comments.map(row => row.revisionId))
    receipts.value = receipts.value.filter(row => !publicRevisions.has(row.revisionId))
  } catch (reason) { loadError.value = toStatePanel(reason).message }
  finally { loading.value = false }
}

function signIn() { uni.navigateTo({url:'/pages/auth/login'}) }
function discussion() {
  const stack = getCurrentPages()
  const previous = stack[stack.length - 2]
  if (previous?.route === 'pages/competition/detail') uni.navigateBack()
  else uni.redirectTo({url: discussionUrl.value})
}
function editPost() { uni.redirectTo({url:'/pages/community/editor?id=' + encodeURIComponent(postId.value)}) }
function copyLink(link: string) {
  uni.setClipboardData({data: link, fail: () => { error.value = 'Could not copy the link.' }})
}
async function perform(action: () => Promise<void>) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  notice.value = ''
  try { await action() }
  catch (reason) { error.value = toStatePanel(reason).message }
  finally { busy.value = false }
}
function toggle(kind: PostInteractionKind) {
  const state = interactions.value
  const item = post.value
  if (!state || !item) return
  const key = kind === 'Like' ? 'liked' : 'favorited'
  const count = kind === 'Like' ? 'likes' : 'favorites'
  perform(async () => {
    const result = await api.community!.interact(item.id, kind, !state[key])
    if (state[key] !== result.active) item[count] = Math.max(0, item[count] + (result.active ? 1 : -1))
    state[key] = result.active
  })
}
function confirmDelete(row?: CommunityCommentDto) {
  if (busy.value || !post.value || !ownsContent(viewer.value, row || post.value)) return
  uni.showModal({
    title: row ? 'Delete comment?' : 'Delete post?',
    content: row ? 'This comment will be removed from the discussion.' : 'This post will be removed from the competition discussion.',
    confirmText: 'Delete', confirmColor: '#a3312b',
    success: result => {
      if (!result.confirm) return
      perform(async () => {
        if (!row) {
          await api.community!.deletePost(postId.value)
          discussion()
          return
        }
        await api.community!.deleteComment(row.id)
        receipts.value = receipts.value.filter(item => item.id !== row.id)
        comments.value = comments.value.filter(item => item.id !== row.id)
        if (replying.value?.id === row.id || editing.value?.id === row.id) resetComposer()
        notice.value = 'Comment deleted.'
      })
    },
  })
}
function resetComposer() { editing.value = null; replying.value = null; text.value = '' }
async function compose(row: CommunityCommentDto, edit: boolean) {
  editing.value = edit ? row : null
  replying.value = edit ? null : row
  text.value = edit ? row.text : ''
  error.value = ''
  await nextTick()
  uni.pageScrollTo({selector: '#comment-composer', duration: 160})
}
function sendComment() {
  const body = text.value.trim()
  if (!body) { error.value = 'Enter a comment before submitting.'; return }
  perform(async () => {
    const row = editing.value
      ? await api.community!.editComment(editing.value.id, body)
      : await api.community!.comment(postId.value, body, replying.value?.id ?? null)
    receipts.value = [...receipts.value.filter(item => item.id !== row.id), row]
    resetComposer()
    notice.value = 'Comment submitted for review.'
  })
}
</script>

<template>
  <view class="page-shell">
    <CsHeader back eyebrow="Competition discussion" title="Post" />
    <view class="cm-page cm-stack">
      <StatePanel v-if="loading" title="Loading post" message="Getting this version and its discussion." />
      <StatePanel v-else-if="loadError || !post" title="Post unavailable" :message="loadError" action-label="Try again" @action="load" />
      <template v-else>
        <view class="cm-card">
          <text class="cm-heading">{{ post.username }}</text>
          <text class="cm-meta">{{ post.createdAt.slice(0, 10) }} · {{ post.status }}</text>
          <text v-if="post.status === 'Pending'" class="cm-meta">Your revision is awaiting review.</text>
          <text v-if="post.text" class="cm-body">{{ post.text }}</text>
          <view v-for="link in post.links" :key="link" class="cm-stack">
            <text selectable class="cm-body">{{ link }}</text><button class="cm-action" @click="copyLink(link)">Copy link</button>
          </view>
          <CommunityImage v-for="(imageId, i) in post.imageIds" :key="imageId" :image-id="imageId" :position="i + 1" />
          <view v-if="ownsContent(viewer, post)" class="cm-row">
            <button class="cm-action" :disabled="busy" @click="editPost">Edit post</button>
            <button class="cm-danger" :disabled="busy" @click="confirmDelete()">Delete post</button>
          </view>
          <view v-if="interactions" class="cm-row">
            <button class="cm-action" :class="{'cm-active': interactions.liked}" :aria-pressed="interactions.liked" :disabled="busy" @click="toggle('Like')">{{ interactions.liked ? 'Unlike' : 'Like' }} · {{ post.likes }}</button>
            <button class="cm-action" :class="{'cm-active': interactions.favorited}" :aria-pressed="interactions.favorited" :disabled="busy" @click="toggle('Favorite')">{{ interactions.favorited ? 'Unfavorite' : 'Favorite' }} · {{ post.favorites }}</button>
          </view>
          <text v-else-if="post.status === 'Approved'" class="cm-meta">{{ post.likes }} likes · {{ post.favorites }} favorites</text>
        </view>
        <template v-if="post.status === 'Approved'">
          <text class="cm-heading">Comments</text>
          <text v-if="!visibleComments.length" class="cm-meta">No published comments yet.</text>
          <view v-for="row in visibleComments" :key="row.id" class="cm-card">
            <text class="cm-meta">{{ row.username }} · {{ row.status }}</text>
            <text v-if="row.parentId" class="cm-meta cm-reply">Reply to {{ parents.get(row.parentId)?.username || 'earlier comment' }}{{ parents.has(row.parentId) ? ' · ' + parents.get(row.parentId)?.text.slice(0, 80) : '' }}</text>
            <text class="cm-body">{{ row.text }}</text>
            <view v-if="isStudent" class="cm-row">
              <button v-if="row.status === 'Approved'" class="cm-action" :disabled="busy" @click="compose(row, false)">Reply</button>
              <template v-if="ownsContent(viewer, row)">
                <button class="cm-action" :disabled="busy" @click="compose(row, true)">Edit comment</button>
                <button class="cm-danger" :disabled="busy" @click="confirmDelete(row)">Delete comment</button>
              </template>
            </view>
          </view>
          <view v-if="isStudent" id="comment-composer" class="cm-card">
            <label class="cm-label">{{ editing ? 'Edit your comment' : replying ? 'Reply to ' + replying.username : 'New comment' }}
              <textarea v-model="text" :disabled="busy" class="cm-textarea" :maxlength="10000" placeholder="Write a comment" />
            </label>
            <button class="cm-primary" :disabled="busy || !text.trim()" @click="sendComment">{{ editing ? 'Submit edit' : replying ? 'Submit reply' : 'Submit comment' }}</button>
            <button v-if="editing || replying" class="cm-action" :disabled="busy" @click="resetComposer">Cancel</button>
          </view>
          <button v-else class="cm-action" @click="signIn">Sign in to participate</button>
        </template>
        <text v-if="notice" class="cm-success" role="status">{{ notice }}</text>
        <text v-if="error" class="cm-error" role="alert">{{ error }}</text>
        <button class="cm-action" @click="discussion">Back to discussion</button>
      </template>
    </view>
    <CsBottomNav active="Competitions" />
  </view>
</template>
<style src="../../styles/community.css"></style>
