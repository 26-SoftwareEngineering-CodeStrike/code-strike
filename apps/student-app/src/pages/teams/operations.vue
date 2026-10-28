<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import type { ActiveMemberContact, PrototypeActor, TeamMemberView, TeamOperationsView } from '@codestrike/contracts'
import { createStudentApiClient } from '../../api/client'
import CsBottomNav from '../../components/CsBottomNav.vue'
import CsHeader from '../../components/CsHeader.vue'
import PersonaSwitcher from '../../components/PersonaSwitcher.vue'
import StatePanel from '../../components/StatePanel.vue'
import StatusBadge from '../../components/StatusBadge.vue'

const api = createStudentApiClient()
const teamId = ref('team-alpha')
const actors = ref<PrototypeActor[]>([])
const actorId = ref('visitor')
const model = ref<TeamOperationsView | null>(null)
const contacts = ref<ActiveMemberContact[]>([])
const loading = ref(true)
const errorMessage = ref('')
const feedback = ref('')
const labOpen = ref(false)
const isCaptain = computed(() => model.value?.team.membershipRole === 'Captain' && model.value.team.canManageMembers)

onLoad((options) => { if (typeof options?.id === 'string' && options.id) teamId.value = options.id })
onShow(initialize)
async function initialize() {
  const [available, current] = await Promise.all([api.listPrototypeActors(), api.getPrototypeActor()])
  actors.value = available.filter((actor) => ['visitor', 'captain-alpha', 'alpha-successor', 'captain-delta', 'delta-member', 'former-captain-alpha'].includes(actor.id))
  actorId.value = current.id
  await loadOperations()
}
async function selectActor(id: string) { const result = await api.selectPrototypeActor(id); if (result.ok) actorId.value = id; feedback.value = ''; await loadOperations() }
async function loadOperations() {
  loading.value = true; errorMessage.value = ''; contacts.value = []
  const result = await api.getTeamOperations(teamId.value)
  if (!result.ok || !result.data) { model.value = null; errorMessage.value = result.message; loading.value = false; return }
  model.value = result.data
  if (result.data.team.membershipRole === 'Captain') {
    const contactResult = await api.getActiveMemberContacts(teamId.value)
    if (contactResult.ok) contacts.value = contactResult.data || []
  }
  loading.value = false
}
function contactFor(member: TeamMemberView) { return contacts.value.find((item) => item.membershipId === member.membershipId) }
function confirmAction(title: string, content: string, action: () => Promise<void>) { uni.showModal({ title, content, success: (modal) => { if (modal.confirm) action() } }) }
function leave() { confirmAction('Leave this team?', 'Membership becomes Ended. Previous Pending or Invalidated applications will not be restored.', async () => { const result = await api.leaveTeam(teamId.value); feedback.value = result.message; await loadOperations() }) }
function remove(member: TeamMemberView) { confirmAction('Remove this member?', `@${member.username} will lose current membership and protected team access.`, async () => { const result = await api.removeMember(teamId.value, member.membershipId); feedback.value = result.message; await loadOperations() }) }
function transfer(member: TeamMemberView) { confirmAction('Transfer captaincy?', `@${member.username} becomes captain immediately. Your captain permissions end immediately.`, async () => { const result = await api.transferCaptain(teamId.value, member.membershipId); feedback.value = result.message; await loadOperations() }) }
function dissolve() { confirmAction('Dissolve this team?', 'All active memberships end and Pending applications become Invalidated. This cannot be undone in the prototype.', async () => { const result = await api.dissolveTeam(teamId.value); feedback.value = result.message; await loadOperations() }) }
function openMyTeams() { uni.redirectTo({ url: '/pages/teams/index' }) }
</script>

<template>
  <view class="page-shell"><CsHeader back demo eyebrow="Team membership" title="Team operations" @demo="labOpen = true" />
    <view class="content">
      <text v-if="feedback" class="feedback">{{ feedback }}</text>
      <StatePanel v-if="loading" title="Loading active membership" message="Rechecking team lifecycle, membership and current captain scope." />
      <StatePanel v-else-if="errorMessage || !model" title="Team access unavailable" :message="errorMessage || 'No active team access.'" action-label="Return to My Teams" @action="openMyTeams" />
      <template v-else>
        <view class="team-card"><view class="team-card__top"><view><text class="competition">{{ model.team.competitionTitle }}</text><text class="team-name">{{ model.team.name }}</text></view><StatusBadge :label="model.team.membershipRole.toUpperCase()" :tone="isCaptain ? 'info' : 'neutral'" /></view><text class="team-card__copy">{{ model.team.memberCount }} / {{ model.team.capacity }} active members · @{{ model.team.captainUsername }} is current captain.</text></view>
        <view class="privacy"><text class="privacy__title">Member privacy</text><text class="privacy__copy">Contact details are available only to the current captain.</text></view>
        <view class="section-head"><text>Active members</text><text>{{ model.members.length }}</text></view>
        <view v-for="member in model.members" :key="member.membershipId" class="member-card"><view class="member-card__identity"><view><text class="username">@{{ member.username }}</text><text class="role">{{ member.role }}</text></view><StatusBadge label="ACTIVE" tone="positive" /></view><view v-if="isCaptain && contactFor(member)" class="contact"><text class="contact__label">CAPTAIN-ONLY CURRENT CONTACT</text><text>WeChat: {{ contactFor(member)?.wechatId || 'Not provided' }}</text><text>QQ: {{ contactFor(member)?.qqId || 'Not provided' }}</text></view><view v-if="isCaptain && member.role === 'Member'" class="member-actions"><button class="transfer" @click="transfer(member)">Transfer Captain</button><button class="remove" @click="remove(member)">Remove Member</button></view></view>
        <button v-if="model.team.canLeave" class="leave" @click="leave">Leave Team</button>
        <view v-if="isCaptain" class="captain-zone"><text class="captain-zone__title">Captain controls</text><text class="captain-zone__copy">Captain cannot leave directly. Transfer captaincy to an active member or dissolve the team.</text><button class="blocked" @click="leave">Try to Leave as Captain</button><button class="dissolve" @click="dissolve">Dissolve Team</button></view>
        <text class="disclaimer">No internal chat, task board, milestone or file-management feature is included.</text>
      </template>
    </view><PersonaSwitcher :actors="actors" :selected-id="actorId" overlay :open="labOpen" @select="selectActor" @close="labOpen = false" /><CsBottomNav active="Teams" /></view>
</template>

<style scoped>
.content{max-width:860px;margin:0 auto;padding:28rpx 26rpx 210rpx}.feedback{display:block;margin:18rpx 0;padding:18rpx 20rpx;color:#25405f;background:#e4f4ff;border-radius:16rpx;font-size:21rpx;line-height:1.5}.team-card,.privacy,.member-card,.captain-zone{margin-top:20rpx;padding:26rpx;border-radius:26rpx}.team-card,.member-card{background:#fff;border:1rpx solid #dfe6ee}.team-card__top,.member-card__identity,.section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14rpx}.competition,.team-name,.team-card__copy,.privacy__title,.privacy__copy,.username,.role,.contact__label,.contact text,.captain-zone__title,.captain-zone__copy,.disclaimer{display:block}.competition{color:#65748a;font-size:20rpx}.team-name{margin-top:7rpx;font-size:31rpx;font-weight:900}.team-card__copy{margin-top:17rpx;color:#5f6f85;font-size:21rpx;line-height:1.5}.privacy{color:#285b50;background:#dff8f1}.privacy__title{font-size:25rpx;font-weight:900}.privacy__copy{margin-top:8rpx;font-size:21rpx;line-height:1.5}.section-head{align-items:center;margin:28rpx 3rpx 8rpx;color:#68778d;font-size:20rpx;font-weight:900;letter-spacing:1.3rpx}.username{font-size:26rpx;font-weight:900}.role{margin-top:6rpx;color:#718096;font-size:20rpx}.contact{margin-top:18rpx;padding:17rpx;color:#304761;background:#eef5ff;border-radius:15rpx;font-size:20rpx;line-height:1.55}.contact__label{margin-bottom:6rpx;color:#245ac8;font-size:18rpx;font-weight:900;letter-spacing:1.2rpx}.member-actions{display:grid;grid-template-columns:1fr 1fr;gap:10rpx;margin-top:18rpx}.member-actions button,.leave,.captain-zone button{margin:0;padding:18rpx;border-radius:15rpx;font-size:21rpx;font-weight:850}.member-actions button{color:#245ac8;background:#e8f0ff}.member-actions .remove{color:#8b322a;background:#ffe9e4}.leave{width:100%;margin-top:22rpx;color:#8b322a;background:#ffe9e4}.captain-zone{color:#f2e9e7;background:#552f32}.captain-zone__title{color:#fff;font-size:27rpx;font-weight:900}.captain-zone__copy{margin-top:8rpx;font-size:21rpx;line-height:1.5}.captain-zone button{width:100%;margin-top:16rpx}.captain-zone .blocked{color:#704331;background:#ffd8c8}.captain-zone .dissolve{color:#fff;background:#c8483b}.disclaimer{margin-top:20rpx;color:#6f7d91;font-size:20rpx;line-height:1.5;text-align:center}@media(min-width:680px){.content{padding:40px 40px 170px}}
.content { max-width:860px; margin:0 auto; padding:20px 16px; padding-bottom:calc(128px + constant(safe-area-inset-bottom)); padding-bottom:calc(128px + env(safe-area-inset-bottom)); }.feedback { display:block; margin:0 0 14px; padding:13px 15px; color:#344054; background:#eef4ff; border-radius:12px; font-size:14px; }
.team-card,.privacy,.member-card,.captain-zone { margin-top:14px; padding:18px; border-radius:16px; }.team-card,.member-card { background:#fff; border:1px solid #dfe4ea; }.team-card__top,.member-card__identity,.section-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }.competition,.team-name,.team-card__copy,.privacy__title,.privacy__copy,.username,.role,.contact__label,.contact text,.captain-zone__title,.captain-zone__copy,.disclaimer { display:block; }.competition { color:#667085; font-size:13px; }.team-name { margin-top:4px; color:#14213d; font-size:21px; font-weight:750; }.team-card__copy { margin-top:12px; color:#667085; font-size:14px; line-height:1.5; }
.privacy { color:#126b57; background:#edf8f4; border:1px solid #cbe9df; }.privacy__title { font-size:15px; font-weight:750; }.privacy__copy { margin-top:3px; font-size:14px; line-height:1.45; }.section-head { align-items:center; margin:24px 2px 8px; color:#14213d; font-size:19px; font-weight:750; letter-spacing:0; }.username { font-size:18px; font-weight:750; }.role { margin-top:3px; color:#667085; font-size:13px; }.contact { margin-top:13px; padding:12px; color:#344054; background:#eef4ff; border-radius:10px; font-size:14px; line-height:1.5; }.contact__label { margin-bottom:4px; color:#1e56b3; font-size:12px; font-weight:750; letter-spacing:.04em; }.member-actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:14px; }.member-actions button,.leave,.captain-zone button { min-height:44px; margin:0; padding:0 12px; border-radius:10px; font-size:14px; font-weight:700; }.member-actions button { color:#1e56b3; background:#eef4ff; }.member-actions .remove,.leave { color:#9f3f38; background:#fff0ec; }.leave { width:100%; margin-top:14px; }.captain-zone { color:#344054; background:#fff; border:1px solid #e9c5c1; }.captain-zone__title { color:#9f3f38; font-size:18px; font-weight:750; }.captain-zone__copy { margin-top:5px; color:#667085; font-size:14px; line-height:1.5; }.captain-zone button { width:100%; margin-top:12px; }.captain-zone .blocked { color:#475467; background:#eef3f8; }.captain-zone .dissolve { color:#fff; background:#b54742; }.disclaimer { margin-top:16px; color:#667085; font-size:13px; line-height:1.45; text-align:left; }
@media(min-width:680px){.content{padding:28px 40px calc(138px + env(safe-area-inset-bottom));}.member-list{grid-template-columns:1fr 1fr}}
</style>
