<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import type { ApplicationHistoryItem, PrototypeActor } from '@codestrike/contracts'
import { createStudentApiClient } from '../../api/client'
import CsBottomNav from '../../components/CsBottomNav.vue'
import CsHeader from '../../components/CsHeader.vue'
import PersonaSwitcher from '../../components/PersonaSwitcher.vue'
import StatePanel from '../../components/StatePanel.vue'

const api = createStudentApiClient()
const actors = ref<PrototypeActor[]>([])
const actorId = ref('visitor')
const applications = ref<ApplicationHistoryItem[]>([])
const loading = ref(true)
const errorMessage = ref('')
const feedback = ref('')
const labOpen = ref(false)

onShow(initialize)

async function initialize() {
  loading.value = true
  const [available, current] = await Promise.all([api.listPrototypeActors(), api.getPrototypeActor()])
  actors.value = available.filter((actor) => ['visitor', 'student-alex'].includes(actor.id))
  actorId.value = current.id
  await loadHistory()
}
async function loadHistory() {
  loading.value = true; errorMessage.value = ''
  const result = await api.listMyApplications()
  if (result.ok) applications.value = result.data || []
  else { applications.value = []; errorMessage.value = result.message }
  loading.value = false
}
async function selectActor(id: string) {
  const result = await api.selectPrototypeActor(id); if (result.ok) actorId.value = id; feedback.value = ''; await loadHistory()
}
function confirmAction(title: string, content: string, action: () => Promise<void>) {
  uni.showModal({ title, content, success: (result) => { if (result.confirm) action() } })
}
function withdraw(item: ApplicationHistoryItem) {
  confirmAction('Withdraw application?', 'The Pending record will become Withdrawn and stay in history.', async () => {
    const result = await api.withdrawApplication(item.id); feedback.value = result.message; await loadHistory()
  })
}
function reapply(item: ApplicationHistoryItem) {
  confirmAction('Create a new application?', 'Current eligibility is checked. The old history record will not be changed.', async () => {
    const result = await api.reapply(item.id); feedback.value = result.message; await loadHistory()
  })
}
function statusClass(status: string) { return `status--${status.toLowerCase()}` }
function openCaptainReview() { uni.navigateTo({ url: '/pages/captain/review' }) }
function browseTeamAlpha() { uni.navigateTo({ url: '/pages/recruitment/detail?id=team-alpha' }) }
</script>

<template>
  <view class="page-shell"><CsHeader back demo eyebrow="Recruitment" title="My applications" @demo="labOpen = true" />
    <view class="content">
      <text v-if="feedback" class="feedback">{{ feedback }}</text>
      <StatePanel v-if="loading" title="Loading application history" message="Getting your latest application records." />
      <StatePanel v-else-if="errorMessage" title="Owner access required" :message="errorMessage" />
      <StatePanel v-else-if="applications.length === 0" title="No applications yet" message="Eligible applications created from a public recruitment will appear here." />
      <view v-else class="history">
        <view class="intro"><text class="intro__label">Application history</text><text class="intro__copy">Track every application and its latest outcome. A past approval may remain here after membership ends.</text></view>
        <view v-for="item in applications" :key="item.id" class="application-card">
          <view class="application-card__top"><view><text class="competition">{{ item.competitionTitle }}</text><text class="team">{{ item.teamName }}</text></view><text class="status" :class="statusClass(item.status)">{{ item.status }}</text></view>
          <view class="dates"><text>Submitted {{ item.submittedDate }}</text><text>Updated {{ item.updatedDate }}</text></view>
          <text v-if="item.reason" class="reason">{{ item.reason }}</text>
          <view v-if="item.status === 'Approved'" class="membership" :class="{ current: item.isCurrentMembership }">{{ item.isCurrentMembership ? 'Current active membership' : 'Historical approval · membership ended' }}</view>
          <button v-if="item.canWithdraw" class="action action--withdraw" @click="withdraw(item)">Withdraw Application</button>
          <button v-else-if="item.canReapply" class="action" @click="reapply(item)">Check eligibility and reapply</button>
        </view>
      </view>
      <button class="browse-link" @click="browseTeamAlpha">Browse Team Alpha recruitment</button>
      <button class="captain-link" @click="openCaptainReview">Captain review</button>
    </view><PersonaSwitcher :actors="actors" :selected-id="actorId" overlay :open="labOpen" @select="selectActor" @close="labOpen = false" /><CsBottomNav active="Teams" /></view>
</template>

<style scoped>
.content{max-width:860px;margin:0 auto;padding:28rpx 26rpx 210rpx}.feedback{display:block;margin:18rpx 0;padding:18rpx 20rpx;color:#25405f;background:#e4f4ff;border-radius:16rpx;font-size:21rpx;line-height:1.45}.history{display:flex;flex-direction:column;gap:18rpx;margin-top:22rpx}.intro{padding:26rpx;color:#dce6f5;background:#13233e;border-radius:24rpx}.intro__label,.intro__copy,.competition,.team,.reason,.membership,.disclaimer{display:block}.intro__label{color:#d9ff74;font-size:20rpx;font-weight:900;letter-spacing:1.5rpx}.intro__copy{margin-top:10rpx;font-size:21rpx;line-height:1.5}.application-card{padding:26rpx;background:#fff;border:1rpx solid #dfe6ee;border-radius:26rpx}.application-card__top{display:flex;align-items:flex-start;justify-content:space-between;gap:16rpx}.competition{color:#65748a;font-size:20rpx;line-height:1.35}.team{margin-top:8rpx;font-size:29rpx;font-weight:850}.status{flex:none;padding:9rpx 13rpx;border-radius:999rpx;font-size:19rpx;font-weight:900}.status--pending{color:#704b00;background:#ffe6a6}.status--approved{color:#075b49;background:#c9f5e9}.status--rejected{color:#8a2f2c;background:#ffe0da}.status--withdrawn{color:#4e596b;background:#e8edf3}.status--invalidated{color:#fff;background:#596579}.dates{display:flex;flex-wrap:wrap;gap:10rpx 22rpx;margin-top:20rpx;color:#748196;font-size:20rpx}.reason,.membership{margin-top:16rpx;padding:16rpx 18rpx;color:#4c5d74;background:#f3f6f9;border-radius:14rpx;font-size:21rpx;line-height:1.45}.membership.current{color:#075b49;background:#def8ef}.action,.browse-link,.captain-link{width:100%;margin:18rpx 0 0;padding:20rpx;border-radius:17rpx;font-size:23rpx;font-weight:850;line-height:1.2}.action,.browse-link{color:#245ac8;background:#e8f0ff}.action--withdraw{color:#8a3c34;background:#fff0ec}.captain-link{color:#fff;background:#245ac8}.disclaimer{margin-top:18rpx;color:#6c7b90;font-size:20rpx;line-height:1.5;text-align:center}@media(min-width:680px){.content{padding:40px 40px 170px}.history{display:grid;grid-template-columns:1fr 1fr}.intro{grid-column:1/-1}}
.content{padding-bottom:280rpx}
.content { max-width:860px; margin:0 auto; padding:20px 16px; padding-bottom:calc(128px + constant(safe-area-inset-bottom)); padding-bottom:calc(128px + env(safe-area-inset-bottom)); }.feedback { display:block; margin:0 0 14px; padding:13px 15px; color:#344054; background:#eef4ff; border-radius:12px; font-size:14px; }.history { display:flex; flex-direction:column; gap:12px; margin-top:14px; }.intro { padding:16px 18px; color:#344054; background:#fff; border:1px solid #dfe4ea; border-radius:15px; }.intro__label,.intro__copy,.competition,.team,.reason,.membership { display:block; }.intro__label { color:#14213d; font-size:18px; font-weight:750; letter-spacing:0; }.intro__copy { margin-top:5px; color:#667085; font-size:14px; line-height:1.5; }.application-card { padding:18px; background:#fff; border:1px solid #dfe4ea; border-radius:16px; }.application-card__top { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }.competition { color:#667085; font-size:13px; line-height:1.35; }.team { margin-top:4px; color:#14213d; font-size:20px; font-weight:750; }.status { flex:none; padding:5px 9px; border-radius:7px; font-size:12px; font-weight:750; }.status--pending{color:#6f4a00;background:#fff3d6}.status--approved{color:#126b57;background:#edf8f4}.status--rejected{color:#9f3f38;background:#fff0ec}.status--withdrawn{color:#667085;background:#eef3f8}.status--invalidated{color:#475467;background:#e7ebf0}.dates { display:flex; flex-wrap:wrap; gap:6px 16px; margin-top:14px; color:#667085; font-size:13px; }.reason,.membership { margin-top:12px; padding:12px; color:#475467; background:#f7f9fb; border-radius:10px; font-size:14px; line-height:1.45; }.membership.current { color:#126b57; background:#edf8f4; }.action,.browse-link,.captain-link { width:100%; min-height:46px; margin:14px 0 0; border-radius:11px; font-size:14px; font-weight:700; }.action,.browse-link { color:#1e56b3; background:#eef4ff; }.action--withdraw { color:#9f3f38; background:#fff0ec; }.captain-link { color:#475467; background:#eef3f8; }
@media(min-width:680px){.content{padding:28px 40px calc(138px + env(safe-area-inset-bottom));}.history{display:grid;grid-template-columns:1fr 1fr}.intro{grid-column:1/-1}}
</style>
