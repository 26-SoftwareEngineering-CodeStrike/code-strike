<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import type { CaptainPendingApplication, PrototypeActor } from '@codestrike/contracts'
import { createStudentApiClient } from '../../api/client'
import CsBottomNav from '../../components/CsBottomNav.vue'
import CsHeader from '../../components/CsHeader.vue'
import PersonaSwitcher from '../../components/PersonaSwitcher.vue'
import StatePanel from '../../components/StatePanel.vue'

const api = createStudentApiClient()
const actors = ref<PrototypeActor[]>([])
const actorId = ref('visitor')
const queue = ref<CaptainPendingApplication[]>([])
const loading = ref(true)
const errorMessage = ref('')
const feedback = ref('')

onShow(initialize)
async function initialize() {
  const [available, current] = await Promise.all([api.listPrototypeActors(), api.getPrototypeActor()])
  actors.value = available.filter((actor) => ['visitor', 'captain-alpha', 'captain-delta', 'former-captain-alpha', 'admin-reviewer'].includes(actor.id))
  actorId.value = current.id
  await loadQueue()
}
async function selectActor(id: string) {
  const result = await api.selectPrototypeActor(id); if (result.ok) actorId.value = id; feedback.value = result.message; await loadQueue()
}
async function loadQueue() {
  loading.value = true; errorMessage.value = ''
  const result = await api.listCaptainApplications()
  if (result.ok) queue.value = result.data || []
  else { queue.value = []; errorMessage.value = result.message }
  loading.value = false
}
function process(item: CaptainPendingApplication, decision: 'approve' | 'reject') {
  uni.showModal({ title: decision === 'approve' ? 'Approve applicant?' : 'Reject applicant?', content: decision === 'approve' ? 'Capacity, deadline, active membership and Pending status will be rechecked.' : 'The result remains in application history.', success: async (modal) => {
    if (!modal.confirm) return
    const result = decision === 'approve' ? await api.approveApplication(item.id) : await api.rejectApplication(item.id)
    feedback.value = result.message; await loadQueue()
  } })
}
function openRevisionReview() { uni.navigateTo({ url: '/pages/prototype/recruitment-review?id=team-delta' }) }
</script>

<template>
  <view class="page-shell"><CsHeader back eyebrow="UI-14 · CURRENT CAPTAIN" title="Captain Review" />
    <view class="content">
      <PersonaSwitcher :actors="actors" :selected-id="actorId" @select="selectActor" />
      <text v-if="feedback" class="feedback">{{ feedback }}</text>
      <view v-if="actorId === 'captain-delta' || actorId === 'admin-reviewer'" class="review-lab"><text class="review-lab__label">ISOLATED DESIGN REVIEW</text><text class="review-lab__copy">This explicit scoped persona may inspect Team Delta's effective and draft recruitment versions.</text><button @click="openRevisionReview">Inspect revision differences</button></view>
      <StatePanel v-if="loading" title="Loading Pending queue" message="Applying current-captain scope to a sanitized Mock response." />
      <StatePanel v-else-if="errorMessage" title="Captain access denied" :message="errorMessage" />
      <StatePanel v-else-if="queue.length === 0" title="No Pending applications" message="Only active Pending records for the current captain's team appear here." />
      <view v-else class="queue">
        <view class="privacy-note"><text class="privacy-note__title">Pre-admission privacy boundary</text><text class="privacy-note__copy">Response DTO contains exactly Name, College, Sex, Skill tags and Brief CV. It contains no contact or extra academic fields.</text></view>
        <view v-for="item in queue" :key="item.id" class="applicant-card">
          <view class="applicant-card__top"><view><text class="eyebrow">{{ item.teamName }} · {{ item.submittedDate }}</text><text class="name" :class="{ 'name--not-matched': item.matchStatus === 'NotMatched' }">{{ item.applicant.name }}</text></view><text class="match" :class="{ mismatch: item.matchStatus === 'NotMatched' }">{{ item.matchStatus === 'NotMatched' ? 'NOT MATCHED' : 'MATCHED' }}</text></view>
          <view class="fields"><view><text class="field__label">COLLEGE</text><text class="field__value">{{ item.applicant.college }}</text></view><view><text class="field__label">SEX</text><text class="field__value">{{ item.applicant.sex }}</text></view><view><text class="field__label">SKILL TAGS</text><view class="skills"><text v-for="skill in item.applicant.skillTags" :key="skill">{{ skill }}</text></view></view><view><text class="field__label">BRIEF CV</text><text class="field__value">{{ item.applicant.briefCv }}</text></view></view>
          <text v-if="item.matchStatus === 'NotMatched'" class="advisory">No skill overlap. Manual approval remains available.</text>
          <view class="actions"><button class="reject" @click="process(item, 'reject')">Reject</button><button class="approve" @click="process(item, 'approve')">Approve</button></view>
        </view>
      </view>
      <text class="disclaimer">Mock authorization and state transitions only; no backend policy or concurrent transaction is claimed.</text>
    </view><CsBottomNav active="Teams" /></view>
</template>

<style scoped>
.content{max-width:900px;margin:0 auto;padding:28rpx 26rpx 210rpx}.feedback{display:block;margin:18rpx 0;padding:18rpx 20rpx;color:#25405f;background:#e4f4ff;border-radius:16rpx;font-size:21rpx;line-height:1.45}.review-lab{margin-top:20rpx;padding:24rpx;color:#dce6f5;background:#13233e;border-radius:24rpx}.review-lab__label,.review-lab__copy,.privacy-note__title,.privacy-note__copy,.eyebrow,.name,.field__label,.field__value,.advisory,.disclaimer{display:block}.review-lab__label{color:#ffb39f;font-size:20rpx;font-weight:900;letter-spacing:1.5rpx}.review-lab__copy{margin-top:10rpx;font-size:21rpx;line-height:1.5}.review-lab button{margin:18rpx 0 0;padding:17rpx;color:#0a1830;background:#fff;border-radius:15rpx;font-size:22rpx;font-weight:850}.queue{display:flex;flex-direction:column;gap:18rpx;margin-top:22rpx}.privacy-note{padding:24rpx;background:#dff8f1;border-radius:22rpx}.privacy-note__title{font-size:24rpx;font-weight:850}.privacy-note__copy{margin-top:8rpx;color:#47675f;font-size:21rpx;line-height:1.5}.applicant-card{padding:26rpx;background:#fff;border:1rpx solid #dfe6ee;border-radius:26rpx}.applicant-card__top{display:flex;align-items:flex-start;justify-content:space-between;gap:16rpx}.eyebrow{color:#748196;font-size:19rpx}.name{margin-top:8rpx;font-size:31rpx;font-weight:900}.name--not-matched{color:#c44731;text-decoration:underline;text-decoration-thickness:4rpx;text-decoration-color:#ffb5a6}.match{flex:none;padding:9rpx 13rpx;color:#075b49;background:#c9f5e9;border-radius:999rpx;font-size:18rpx;font-weight:900}.match.mismatch{color:#8a2f2c;background:#ffe0da}.fields{display:grid;gap:18rpx;margin-top:24rpx;padding-top:22rpx;border-top:1rpx solid #e4e9f0}.field__label{color:#748196;font-size:19rpx;font-weight:900;letter-spacing:1.3rpx}.field__value{margin-top:7rpx;color:#283850;font-size:22rpx;line-height:1.5}.skills{display:flex;flex-wrap:wrap;gap:8rpx;margin-top:9rpx}.skills text{padding:9rpx 13rpx;color:#193f78;background:#e6f0ff;border-radius:12rpx;font-size:20rpx;font-weight:800}.advisory{margin-top:20rpx;padding:16rpx;color:#813a2e;background:#fff0ec;border-radius:14rpx;font-size:21rpx;line-height:1.45}.actions{display:grid;grid-template-columns:1fr 1fr;gap:12rpx;margin-top:22rpx}.actions button{margin:0;padding:20rpx;border-radius:16rpx;font-size:23rpx;font-weight:850}.reject{color:#8a2f2c;background:#ffe9e4}.approve{color:#0a1830;background:#d9ff74}.disclaimer{margin-top:20rpx;color:#6c7b90;font-size:20rpx;line-height:1.5;text-align:center}@media(min-width:680px){.content{padding:40px 40px 170px}.queue{display:grid;grid-template-columns:1fr 1fr}.privacy-note{grid-column:1/-1}.fields{grid-template-columns:1fr 1fr}}
</style>
