<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import type { PrototypeActor, RecruitmentDetail } from '@codestrike/contracts'
import { createStudentApiClient } from '../../api/client'
import CsHeader from '../../components/CsHeader.vue'
import PersonaSwitcher from '../../components/PersonaSwitcher.vue'
import StatePanel from '../../components/StatePanel.vue'
import StatusBadge from '../../components/StatusBadge.vue'

const api = createStudentApiClient()
const recruitmentId = ref('team-delta')
const recruitment = ref<RecruitmentDetail | null>(null)
const actors = ref<PrototypeActor[]>([])
const actorId = ref('visitor')
const loading = ref(true)
const errorMessage = ref('')
const feedback = ref('')
const labOpen = ref(false)
const canModerate = computed(() => actorId.value === 'admin-reviewer' && Boolean(recruitment.value?.revisionDraft) && ['Pending', 'Delisted'].includes(recruitment.value?.publication || ''))

onLoad((options) => { if (typeof options?.id === 'string' && options.id) recruitmentId.value = options.id; initialize() })
async function initialize() {
  const [available, current] = await Promise.all([api.listPrototypeActors(), api.getPrototypeActor()])
  actors.value = available.filter((actor) => ['visitor', 'student-alex', 'captain-alpha', 'captain-delta', 'alpha-successor', 'former-captain-alpha', 'admin-reviewer'].includes(actor.id))
  actorId.value = current.id
  await loadReview()
}
async function selectActor(id: string) { const result = await api.selectPrototypeActor(id); if (result.ok) actorId.value = id; feedback.value = ''; await loadReview() }
async function loadReview() {
  loading.value = true; errorMessage.value = ''; recruitment.value = null
  try { recruitment.value = await api.getRecruitmentDesignReview(recruitmentId.value) }
  catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Design review denied.' }
  finally { loading.value = false }
}
function moderate(decision: 'Approve' | 'Reject') {
  uni.showModal({ title: `${decision} this exact draft?`, content: decision === 'Approve' ? 'Capacity and current membership are rechecked before promotion to Effective.' : 'The recruitment remains unavailable publicly and the draft can be resubmitted.', success: async (modal) => {
    if (!modal.confirm) return
    const result = await api.moderateRecruitment(recruitmentId.value, decision)
    feedback.value = result.message
    await loadReview()
  } })
}
function openPublicDetail() { uni.navigateTo({ url: `/pages/recruitment/detail?id=${recruitmentId.value}` }) }
</script>

<template>
  <view class="page-shell"><CsHeader back demo eyebrow="Prototype review" title="Recruitment review" @demo="labOpen = true" />
    <view class="content">
      <text v-if="feedback" class="feedback">{{ feedback }}</text>
      <view class="boundary"><text class="boundary__title">Prototype-only review</text><text class="boundary__copy">Opening this page does not grant review access. Choose an authorized demo actor from Prototype Lab.</text></view>
      <StatePanel v-if="loading" title="Checking prototype scope" message="Evaluating the selected in-memory persona and live team scope." />
      <StatePanel v-else-if="errorMessage || !recruitment" title="Design review denied" :message="errorMessage || 'No review data returned.'" />
      <view v-else class="review">
        <view class="badges"><StatusBadge :label="recruitment.publication.toUpperCase()" :tone="recruitment.publication === 'Published' ? 'positive' : recruitment.publication === 'Rejected' || recruitment.publication === 'Delisted' ? 'danger' : 'warning'" /><StatusBadge v-if="recruitment.revisionDraft" label="DRAFT ISOLATED" tone="warning" /></view>
        <text class="team">{{ recruitment.name }}</text><text class="copy">{{ recruitment.publication === 'Published' ? 'The approved version is public; draft values remain isolated from public views.' : 'This recruitment stays absent from public lists and details.' }}</text>
        <view v-if="recruitment.revisionDraft" class="versions"><view><text class="version__label">EFFECTIVE</text><text class="version__title">{{ recruitment.name }}</text><text class="version__copy">{{ recruitment.summary }}</text><text class="version__copy">{{ recruitment.capacity }} people · {{ recruitment.requiredSkills.join(', ') }}</text></view><view><text class="version__label">DRAFT</text><text class="version__title">{{ recruitment.revisionDraft.teamName }}</text><text class="version__copy">{{ recruitment.revisionDraft.summary }}</text><text class="version__copy">{{ recruitment.revisionDraft.capacity }} people · {{ recruitment.revisionDraft.requiredSkills.join(', ') }}</text></view></view>
        <view v-if="canModerate" class="moderation"><text>Review decision</text><view><button class="reject" @click="moderate('Reject')">Reject Draft</button><button class="approve" @click="moderate('Approve')">Approve Draft</button></view></view>
        <text v-else-if="recruitment.revisionDraft" class="captain-limit">{{ recruitment.publication === 'Rejected' ? 'Rejected draft retained for review history. The current captain must resubmit before another Admin decision.' : 'Current captain may inspect differences but cannot approve their own draft.' }}</text>
      </view>
      <button v-if="recruitment" class="public-check" @click="openPublicDetail">Open public view</button><text class="disclaimer">Prototype-only review: actor switching is not real authentication or server authorization.</text>
    </view><PersonaSwitcher :actors="actors" :selected-id="actorId" overlay :open="labOpen" @select="selectActor" @close="labOpen = false" /></view>
</template>

<style scoped>
.content{max-width:860px;margin:0 auto;padding:28rpx 26rpx 90rpx}.feedback{display:block;margin:18rpx 0;padding:18rpx 20rpx;color:#25405f;background:#e4f4ff;border-radius:16rpx;font-size:21rpx}.boundary{margin-top:20rpx;padding:22rpx;color:#653a00;background:#ffe5a8;border-radius:20rpx}.boundary__title,.boundary__copy,.team,.copy,.version__label,.version__title,.version__copy,.captain-limit,.disclaimer{display:block}.boundary__title{font-size:24rpx;font-weight:900}.boundary__copy{margin-top:8rpx;font-size:21rpx;line-height:1.5}.review{margin-top:22rpx;padding:28rpx;color:#e6edf7;background:#13233e;border-radius:28rpx}.badges{display:flex;flex-wrap:wrap;gap:10rpx}.team{margin-top:20rpx;color:#fff;font-size:34rpx;font-weight:900}.copy{margin-top:10rpx;color:#bac8dc;font-size:21rpx;line-height:1.5}.versions{display:grid;gap:16rpx;margin-top:24rpx}.versions>view{padding:22rpx;background:rgba(255,255,255,.08);border-radius:18rpx}.version__label{color:#d9ff74;font-size:19rpx;font-weight:900;letter-spacing:1.5rpx}.version__title{margin-top:10rpx;color:#fff;font-size:27rpx;font-weight:850}.version__copy{margin-top:8rpx;font-size:21rpx;line-height:1.5}.moderation{margin-top:20rpx;padding-top:20rpx;border-top:1rpx solid rgba(255,255,255,.16);color:#d9ff74;font-size:19rpx;font-weight:900;letter-spacing:1.2rpx}.moderation>view{display:grid;grid-template-columns:1fr 1fr;gap:10rpx;margin-top:14rpx}.moderation button{margin:0;padding:18rpx;border-radius:15rpx;font-size:21rpx;font-weight:850}.moderation .reject{color:#8a2f2c;background:#ffe0da}.moderation .approve{color:#0a1830;background:#d9ff74}.captain-limit{margin-top:18rpx;padding:16rpx;background:rgba(255,255,255,.08);border-radius:14rpx;font-size:20rpx;line-height:1.5}.public-check{width:100%;margin:20rpx 0 0;padding:20rpx;color:#245ac8;background:#e8f0ff;border-radius:17rpx;font-size:23rpx;font-weight:850}.disclaimer{margin-top:20rpx;color:#68788e;font-size:20rpx;line-height:1.5;text-align:center}@media(min-width:680px){.content{padding:40px}.versions{grid-template-columns:1fr 1fr}}
.content { max-width:860px; margin:0 auto; padding:20px 16px 44px; }.feedback { display:block; margin:0 0 14px; padding:13px 15px; color:#344054; background:#eef4ff; border-radius:12px; font-size:14px; }.boundary { margin-top:0; padding:15px 16px; color:#6f4a00; background:#fff8e7; border:1px solid #f1dfae; border-radius:14px; }.boundary__title,.boundary__copy,.team,.copy,.version__label,.version__title,.version__copy,.captain-limit,.disclaimer { display:block; }.boundary__title { font-size:15px; font-weight:750; }.boundary__copy { margin-top:3px; font-size:14px; line-height:1.45; }.review { margin-top:14px; padding:18px; color:#344054; background:#fff; border:1px solid #dfe4ea; border-radius:16px; }.badges { display:flex; flex-wrap:wrap; gap:7px; }.team { margin-top:14px; color:#14213d; font-size:22px; font-weight:750; }.copy { margin-top:5px; color:#667085; font-size:14px; line-height:1.5; }.versions { display:grid; gap:10px; margin-top:17px; }.versions>view { padding:15px; background:#f7f9fb; border:1px solid #e1e6ec; border-radius:12px; }.versions>view:last-child { background:#fff8f4; border-color:#efd6ca; }.version__label { color:#667085; font-size:12px; font-weight:750; letter-spacing:.05em; }.version__title { margin-top:6px; color:#14213d; font-size:18px; font-weight:750; }.version__copy { margin-top:5px; color:#475467; font-size:14px; line-height:1.5; }.moderation { margin-top:17px; padding-top:16px; border-top:1px solid #e7ebf0; color:#14213d; font-size:14px; font-weight:750; letter-spacing:0; }.moderation>view { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px; }.moderation button { min-height:46px; margin:0; border-radius:11px; font-size:14px; font-weight:700; }.moderation .reject { color:#9f3f38; background:#fff0ec; }.moderation .approve { color:#fff; background:#2563eb; }.captain-limit { margin-top:14px; padding:12px; color:#6f4a00; background:#fff8e7; border-radius:10px; font-size:14px; line-height:1.45; }.public-check { width:100%; min-height:46px; margin:14px 0 0; color:#1e56b3; background:#eef4ff; border-radius:11px; font-size:14px; font-weight:700; }.disclaimer { margin-top:14px; color:#667085; font-size:13px; line-height:1.45; text-align:left; } @media(min-width:680px){.content{padding:28px 40px 48px}.versions{grid-template-columns:1fr 1fr}}
</style>
