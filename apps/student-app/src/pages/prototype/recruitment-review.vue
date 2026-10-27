<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
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

onLoad((options) => { if (typeof options?.id === 'string' && options.id) recruitmentId.value = options.id; initialize() })
async function initialize() {
  const [available, current] = await Promise.all([api.listPrototypeActors(), api.getPrototypeActor()])
  actors.value = available.filter((actor) => ['visitor', 'student-alex', 'captain-delta', 'former-captain-alpha', 'admin-reviewer'].includes(actor.id))
  actorId.value = current.id
  await loadReview()
}
async function selectActor(id: string) { const result = await api.selectPrototypeActor(id); if (result.ok) actorId.value = id; await loadReview() }
async function loadReview() {
  loading.value = true; errorMessage.value = ''; recruitment.value = null
  try { recruitment.value = await api.getRecruitmentDesignReview(recruitmentId.value) }
  catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Design review denied.' }
  finally { loading.value = false }
}
function openPublicDetail() { uni.navigateTo({ url: '/pages/recruitment/detail?id=team-delta' }) }
</script>

<template>
  <view class="page-shell"><CsHeader back eyebrow="ISOLATED PROTOTYPE FLOW" title="Recruitment Design Review" />
    <view class="content"><PersonaSwitcher :actors="actors" :selected-id="actorId" @select="selectActor" />
      <view class="boundary"><text class="boundary__title">URL parameters never grant access</text><text class="boundary__copy">Only the explicitly selected Team Delta current-captain or admin reviewer persona can receive this Mock review DTO.</text></view>
      <StatePanel v-if="loading" title="Checking prototype scope" message="Evaluating the selected in-memory persona and team scope." />
      <StatePanel v-else-if="errorMessage || !recruitment" title="Design review denied" :message="errorMessage || 'No review data returned.'" />
      <view v-else class="review"><view class="badges"><StatusBadge label="DELISTED" tone="danger" /><StatusBadge label="PENDING REVISION" tone="warning" /></view><text class="team">{{ recruitment.name }}</text><text class="copy">Delisted content stays absent from public list and public detail responses.</text><view v-if="recruitment.revisionDraft" class="versions"><view><text class="version__label">EFFECTIVE</text><text class="version__title">{{ recruitment.name }}</text><text class="version__copy">{{ recruitment.summary }}</text><text class="version__copy">{{ recruitment.capacity }} people · {{ recruitment.requiredSkills.join(', ') }}</text></view><view><text class="version__label">DRAFT</text><text class="version__title">{{ recruitment.revisionDraft.teamName }}</text><text class="version__copy">{{ recruitment.revisionDraft.summary }}</text><text class="version__copy">{{ recruitment.revisionDraft.capacity }} people · {{ recruitment.revisionDraft.requiredSkills.join(', ') }}</text></view></view></view>
      <button v-if="recruitment" class="public-check" @click="openPublicDetail">Open public detail boundary</button>
      <text class="disclaimer">This is a UI design-review simulation, not backend authentication or authorization.</text>
    </view></view>
</template>

<style scoped>
.content{max-width:860px;margin:0 auto;padding:28rpx 26rpx 90rpx}.boundary{margin-top:20rpx;padding:22rpx;color:#653a00;background:#ffe5a8;border-radius:20rpx}.boundary__title,.boundary__copy,.team,.copy,.version__label,.version__title,.version__copy,.disclaimer{display:block}.boundary__title{font-size:24rpx;font-weight:900}.boundary__copy{margin-top:8rpx;font-size:21rpx;line-height:1.5}.review{margin-top:22rpx;padding:28rpx;color:#e6edf7;background:#13233e;border-radius:28rpx}.badges{display:flex;flex-wrap:wrap;gap:10rpx}.team{margin-top:20rpx;color:#fff;font-size:34rpx;font-weight:900}.copy{margin-top:10rpx;color:#bac8dc;font-size:21rpx;line-height:1.5}.versions{display:grid;gap:16rpx;margin-top:24rpx}.versions>view{padding:22rpx;background:rgba(255,255,255,.08);border-radius:18rpx}.version__label{color:#d9ff74;font-size:19rpx;font-weight:900;letter-spacing:1.5rpx}.version__title{margin-top:10rpx;color:#fff;font-size:27rpx;font-weight:850}.version__copy{margin-top:8rpx;font-size:21rpx;line-height:1.5}.disclaimer{margin-top:20rpx;color:#68788e;font-size:20rpx;line-height:1.5;text-align:center}@media(min-width:680px){.content{padding:40px}.versions{grid-template-columns:1fr 1fr}}
.public-check{width:100%;margin:20rpx 0 0;padding:20rpx;color:#245ac8;background:#e8f0ff;border-radius:17rpx;font-size:23rpx;font-weight:850}
</style>
