<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import type { PrototypeActor, RecruitmentManagementView } from '@codestrike/contracts'
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
const model = ref<RecruitmentManagementView | null>(null)
const draftName = ref('')
const draftSummary = ref('')
const draftCapacity = ref(4)
const draftSkills = ref<string[]>([])
const loading = ref(true)
const errorMessage = ref('')
const feedback = ref('')
const labOpen = ref(false)
const skillOptions = ['Python', 'Java', 'Vue', 'Research', 'CAD', 'Product Design', 'Data Visualization', 'Mathematical Modeling']
const capacityOptions = computed(() => model.value ? Array.from({ length: model.value.competitionMaximumTeamSize - model.value.memberCount + 1 }, (_, index) => model.value!.memberCount + index) : [])

onLoad((options) => { if (typeof options?.id === 'string' && options.id) teamId.value = options.id })
onShow(initialize)
async function initialize() {
  const [available, current] = await Promise.all([api.listPrototypeActors(), api.getPrototypeActor()])
  actors.value = available.filter((actor) => ['visitor', 'student-alex', 'captain-alpha', 'captain-delta', 'alpha-successor', 'former-captain-alpha'].includes(actor.id))
  actorId.value = current.id
  await loadManagement()
}
async function selectActor(id: string) { const result = await api.selectPrototypeActor(id); if (result.ok) actorId.value = id; feedback.value = ''; await loadManagement() }
async function loadManagement() {
  loading.value = true; errorMessage.value = ''
  const result = await api.getRecruitmentManagement(teamId.value)
  if (result.ok && result.data) { model.value = result.data; seedDraft(result.data) } else { model.value = null; errorMessage.value = result.message }
  loading.value = false
}
function seedDraft(value: RecruitmentManagementView) {
  const source = value.draft || value.effective
  draftName.value = source.teamName; draftSummary.value = source.summary; draftCapacity.value = source.capacity; draftSkills.value = [...source.requiredSkills]
}
function toggleSkill(skill: string) { draftSkills.value = draftSkills.value.includes(skill) ? draftSkills.value.filter((item) => item !== skill) : [...draftSkills.value, skill] }
function selectCapacity(event: { detail: { value: string } }) { draftCapacity.value = capacityOptions.value[Number(event.detail.value)] }
async function changeSwitch(value: 'Open' | 'Closed') { const result = await api.setRecruitmentSwitch(teamId.value, value); feedback.value = result.message; if (result.ok && result.data) { model.value = result.data; seedDraft(result.data) } }
function submitRevision() {
  uni.showModal({ title: 'Submit recruitment version?', content: model.value?.publication === 'Published' ? 'The entire public recruitment will be Delisted immediately. Effective values stay unchanged until review approval.' : 'This version will remain private while review is Pending.', success: async (modal) => {
    if (!modal.confirm) return
    const result = await api.submitRecruitmentRevision(teamId.value, { teamName: draftName.value, summary: draftSummary.value, capacity: draftCapacity.value, requiredSkills: draftSkills.value })
    feedback.value = result.message; if (result.ok && result.data) { model.value = result.data; seedDraft(result.data) }
  } })
}
function openReview() { uni.navigateTo({ url: `/pages/prototype/recruitment-review?id=${teamId.value}` }) }
</script>

<template>
  <view class="page-shell"><CsHeader back demo eyebrow="Team recruitment" title="Manage recruitment" @demo="labOpen = true" />
    <view class="content">
      <text v-if="feedback" class="feedback">{{ feedback }}</text>
      <StatePanel v-if="loading" title="Loading recruitment controls" message="Rechecking current captain scope and effective team state." />
      <StatePanel v-else-if="errorMessage || !model" title="Captain access denied" :message="errorMessage || 'Recruitment unavailable.'" />
      <template v-else>
        <view class="state-card"><view class="badges"><StatusBadge :label="model.publication.toUpperCase()" :tone="model.publication === 'Published' ? 'positive' : model.publication === 'Rejected' || model.publication === 'Delisted' ? 'danger' : 'warning'" /><StatusBadge :label="`SWITCH ${model.recruitmentSwitch.toUpperCase()}`" :tone="model.recruitmentSwitch === 'Open' ? 'positive' : 'warning'" /><StatusBadge :label="model.lifecycle.toUpperCase()" :tone="model.lifecycle === 'Active' ? 'positive' : 'danger'" /></view><text class="state-card__title">{{ model.competitionTitle }}</text><text class="state-card__copy">{{ model.memberCount }} active members · competition maximum {{ model.competitionMaximumTeamSize }}. Manual closure blocks fresh applications only.</text><view class="switch-actions"><button :class="{ active: model.recruitmentSwitch === 'Open' }" @click="changeSwitch('Open')">Open applications</button><button :class="{ active: model.recruitmentSwitch === 'Closed' }" @click="changeSwitch('Closed')">Close applications</button></view></view>

        <view class="version-card effective"><text class="version-card__label">EFFECTIVE SETTINGS</text><text class="version-card__title">{{ model.effective.teamName }}</text><text class="version-card__copy">{{ model.effective.summary }}</text><text class="version-card__meta">{{ model.effective.capacity }} people · {{ model.effective.requiredSkills.join(', ') }}</text></view>
        <view v-if="model.draft" class="version-card draft"><text class="version-card__label">PENDING / REJECTED DRAFT</text><text class="version-card__title">{{ model.draft.teamName }}</text><text class="version-card__copy">{{ model.draft.summary }}</text><text class="version-card__meta">{{ model.draft.capacity }} people · {{ model.draft.requiredSkills.join(', ') }}</text><text class="draft-note">Draft values do not replace the approved settings until this exact version passes review.</text><button class="review-link" @click="openReview">Open isolated design review</button></view>

        <view class="editor"><text class="editor__heading">{{ model.publication === 'Private' || model.publication === 'Rejected' ? 'Prepare recruitment submission' : 'Prepare a revision' }}</text><text class="label">TEAM NAME</text><input v-model="draftName" class="input" maxlength="60" /><text class="label field">SUMMARY</text><textarea v-model="draftSummary" class="textarea" maxlength="300" /><text class="label field">MAXIMUM TOTAL MEMBERS</text><picker :range="capacityOptions" :value="capacityOptions.indexOf(draftCapacity)" @change="selectCapacity"><view class="input picker">{{ draftCapacity }} people <text>⌄</text></view></picker><text class="hint">Cannot be below {{ model.memberCount }} active members or above {{ model.competitionMaximumTeamSize }}.</text><text class="label field">REQUIRED SKILL TAGS</text><view class="skills"><button v-for="skill in skillOptions" :key="skill" :class="{ active: draftSkills.includes(skill) }" @click="toggleSkill(skill)">{{ skill }}</button></view><button class="submit" :disabled="model.publication === 'Pending' || model.publication === 'Delisted'" @click="submitRevision">{{ model.publication === 'Pending' || model.publication === 'Delisted' ? 'Version already under review' : 'Submit for Review' }}</button></view>
        <text class="disclaimer">Submitted changes remain separate from the approved version until review is complete.</text>
      </template>
    </view><PersonaSwitcher :actors="actors" :selected-id="actorId" overlay :open="labOpen" @select="selectActor" @close="labOpen = false" /><CsBottomNav active="Teams" /></view>
</template>

<style scoped>
.content{max-width:880px;margin:0 auto;padding:28rpx 26rpx 210rpx}.feedback{display:block;margin:18rpx 0;padding:18rpx 20rpx;color:#25405f;background:#e4f4ff;border-radius:16rpx;font-size:21rpx}.state-card,.version-card,.editor{margin-top:20rpx;padding:27rpx;border-radius:27rpx}.state-card,.editor{background:#fff;border:1rpx solid #dfe6ee}.badges,.skills{display:flex;flex-wrap:wrap;gap:9rpx}.state-card__title,.state-card__copy,.version-card__label,.version-card__title,.version-card__copy,.version-card__meta,.draft-note,.editor__heading,.label,.hint,.disclaimer{display:block}.state-card__title{margin-top:20rpx;font-size:28rpx;font-weight:900}.state-card__copy{margin-top:9rpx;color:#607087;font-size:21rpx;line-height:1.5}.switch-actions{display:grid;grid-template-columns:1fr 1fr;gap:10rpx;margin-top:21rpx}.switch-actions button{margin:0;padding:18rpx;color:#5f6f85;background:#edf1f5;border-radius:15rpx;font-size:21rpx;font-weight:800}.switch-actions button.active{color:#fff;background:#245ac8}.version-card{color:#e7eef8;background:#13233e}.version-card.draft{background:#552f32}.version-card__label{color:#d9ff74;font-size:20rpx;font-weight:900;letter-spacing:1.4rpx}.draft .version-card__label{color:#ffb39f}.version-card__title{margin-top:12rpx;color:#fff;font-size:30rpx;font-weight:900}.version-card__copy{margin-top:10rpx;font-size:22rpx;line-height:1.5}.version-card__meta{margin-top:15rpx;color:#c4d1e3;font-size:20rpx}.draft-note{margin-top:18rpx;padding:16rpx;background:rgba(255,255,255,.08);border-radius:14rpx;font-size:20rpx;line-height:1.5}.review-link{margin:18rpx 0 0;padding:17rpx;color:#0a1830;background:#fff;border-radius:15rpx;font-size:22rpx;font-weight:850}.editor__heading{font-size:29rpx;font-weight:900}.label{margin-top:22rpx;color:#68778d;font-size:20rpx;font-weight:900;letter-spacing:1.3rpx}.input,.textarea{width:100%;margin-top:10rpx;padding:19rpx;color:#0a1830;background:#f2f5f8;border:1rpx solid #dce4ed;border-radius:15rpx;font-size:22rpx}.textarea{height:145rpx;line-height:1.5}.picker{display:flex;justify-content:space-between}.hint{margin-top:8rpx;color:#718096;font-size:20rpx;line-height:1.4}.skills{margin-top:12rpx}.skills button{margin:0;padding:13rpx 16rpx;color:#52627a;background:#edf1f5;border-radius:999rpx;font-size:20rpx;line-height:1.1}.skills button.active{color:#fff;background:#245ac8;font-weight:850}.submit{width:100%;margin:24rpx 0 0;padding:21rpx;color:#0a1830;background:#d9ff74;border-radius:17rpx;font-size:23rpx;font-weight:900}.submit[disabled]{color:#785143;background:#ffd9cd}.disclaimer{margin-top:20rpx;color:#6f7d91;font-size:20rpx;line-height:1.5;text-align:center}@media(min-width:680px){.content{padding:40px 40px 170px}}
.content { max-width: 880px; margin: 0 auto; padding: 20px 16px; padding-bottom: calc(128px + constant(safe-area-inset-bottom)); padding-bottom: calc(128px + env(safe-area-inset-bottom)); }
.feedback { display:block; margin:0 0 14px; padding:13px 15px; color:#344054; background:#eef4ff; border:1px solid #cfddf7; border-radius:12px; font-size:14px; }
.state-card,.version-card,.editor { margin-top:14px; padding:18px; border-radius:16px; }.state-card,.editor { background:#fff; border:1px solid #dfe4ea; }
.badges,.skills { display:flex; flex-wrap:wrap; gap:7px; }.state-card__title,.state-card__copy,.version-card__label,.version-card__title,.version-card__copy,.version-card__meta,.draft-note,.editor__heading,.label,.hint,.disclaimer { display:block; }
.state-card__title { margin-top:15px; color:#14213d; font-size:20px; font-weight:750; }.state-card__copy { margin-top:5px; color:#667085; font-size:14px; line-height:1.5; }
.switch-actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:16px; }.switch-actions button { min-height:44px; margin:0; color:#475467; background:#eef3f8; border-radius:10px; font-size:14px; font-weight:700; }.switch-actions button.active { color:#fff; background:#2563eb; }
.version-card { color:#344054; background:#fff; border:1px solid #dfe4ea; }.version-card.effective { border-left:4px solid #16856b; }.version-card.draft { color:#344054; background:#fff8f4; border-color:#efd6ca; border-left:4px solid #b7791f; }.version-card__label,.draft .version-card__label { color:#667085; font-size:12px; font-weight:750; letter-spacing:.06em; }.version-card__title { margin-top:8px; color:#14213d; font-size:19px; font-weight:750; }.version-card__copy { margin-top:6px; color:#475467; font-size:15px; line-height:1.5; }.version-card__meta { margin-top:10px; color:#667085; font-size:13px; }.draft-note { margin-top:13px; padding:12px; color:#6f4a00; background:#fff8e7; border-radius:10px; font-size:13px; line-height:1.45; }.review-link { min-height:44px; margin:13px 0 0; padding:0 14px; color:#1e56b3; background:#eef4ff; border-radius:10px; font-size:14px; font-weight:700; }
.editor__heading { color:#14213d; font-size:20px; font-weight:750; }.label { margin-top:18px; color:#475467; font-size:14px; font-weight:700; letter-spacing:0; }.input,.textarea { width:100%; min-height:46px; margin-top:7px; padding:12px 13px; color:#14213d; background:#f7f9fb; border:1px solid #dfe4ea; border-radius:11px; font-size:15px; }.textarea { height:110px; }.hint { margin-top:6px; color:#667085; font-size:13px; }.skills { margin-top:9px; }.skills button { min-height:40px; margin:0; padding:0 11px; color:#475467; background:#eef3f8; border-radius:9px; font-size:13px; }.skills button.active { color:#1d4ed8; background:#eaf1ff; font-weight:700; }.submit { width:100%; min-height:48px; margin:20px 0 0; color:#fff; background:#2563eb; border-radius:12px; font-size:15px; font-weight:700; }.submit[disabled] { color:#8993a4; background:#e7ebf0; }.disclaimer { margin-top:16px; color:#667085; font-size:13px; line-height:1.45; text-align:left; }
@media(min-width:680px){.content{padding:28px 40px calc(138px + env(safe-area-inset-bottom));}.versions{grid-template-columns:1fr 1fr}}
</style>
