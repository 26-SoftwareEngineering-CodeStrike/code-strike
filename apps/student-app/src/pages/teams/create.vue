<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import type { CompetitionSummary, PrototypeActor } from '@codestrike/contracts'
import { createStudentApiClient } from '../../api/client'
import CsBottomNav from '../../components/CsBottomNav.vue'
import CsHeader from '../../components/CsHeader.vue'
import PersonaSwitcher from '../../components/PersonaSwitcher.vue'

const api = createStudentApiClient()
const actors = ref<PrototypeActor[]>([])
const actorId = ref('visitor')
const competitions = ref<CompetitionSummary[]>([])
const competitionIndex = ref(0)
const name = ref('')
const summary = ref('')
const capacity = ref(4)
const requiredSkills = ref<string[]>(['Python'])
const submitRecruitment = ref(false)
const feedback = ref('')
const createdTeamId = ref('')
const saving = ref(false)
const competitionMaximum = ref(4)
const labOpen = ref(false)

const skillOptions = ['Python', 'Java', 'Vue', 'Research', 'CAD', 'Product Design', 'Data Visualization', 'Mathematical Modeling']
const selectedCompetition = computed(() => competitions.value[competitionIndex.value])
const capacityOptions = computed(() => {
  return Array.from({ length: competitionMaximum.value }, (_, index) => index + 1)
})

onShow(initialize)
async function initialize() {
  const [available, current, competitionItems] = await Promise.all([api.listPrototypeActors(), api.getPrototypeActor(), api.listCompetitions()])
  actors.value = available.filter((actor) => ['visitor', 'student-alex', 'student-incomplete'].includes(actor.id))
  actorId.value = current.id
  competitions.value = competitionItems
  if (competitionItems[0]) competitionMaximum.value = (await api.getCompetition(competitionItems[0].id)).maximumTeamSize
}
async function selectActor(id: string) { const result = await api.selectPrototypeActor(id); if (result.ok) actorId.value = id; feedback.value = ''; createdTeamId.value = '' }
async function selectCompetition(event: { detail: { value: string } }) { competitionIndex.value = Number(event.detail.value); const selected = selectedCompetition.value; if (selected) competitionMaximum.value = (await api.getCompetition(selected.id)).maximumTeamSize; capacity.value = capacityOptions.value[capacityOptions.value.length - 1] }
function selectCapacity(event: { detail: { value: string } }) { capacity.value = capacityOptions.value[Number(event.detail.value)] }
function selectRecruitment(event: Event) { submitRecruitment.value = (event as Event & { detail: { value: boolean } }).detail.value }
function toggleSkill(skill: string) { requiredSkills.value = requiredSkills.value.includes(skill) ? requiredSkills.value.filter((item) => item !== skill) : [...requiredSkills.value, skill] }
async function createTeam() {
  if (!selectedCompetition.value || saving.value) return
  saving.value = true
  const result = await api.createTeam({ competitionId: selectedCompetition.value.id, name: name.value, summary: summary.value, capacity: capacity.value, requiredSkills: requiredSkills.value, submitRecruitment: submitRecruitment.value })
  feedback.value = result.message
  createdTeamId.value = result.ok ? result.data?.id || '' : ''
  saving.value = false
}
function openMyTeams() { uni.redirectTo({ url: '/pages/teams/index' }) }
</script>

<template>
  <view class="page-shell"><CsHeader back demo eyebrow="Team setup" title="Create team" @demo="labOpen = true" />
    <view class="content">
      <view class="intro"><text class="intro__title">Build your competition team</text><text class="intro__copy">Choose a competition, describe your goal and set the skills you need.</text></view>
      <view class="notice"><text class="notice__title">Eligibility is checked when you create the team</text><text class="notice__copy">Complete your profile and confirm that the competition is still open before submitting.</text></view>
      <view class="form-card">
        <text class="form-heading">Team details</text><text class="label">Competition</text><picker :range="competitions" range-key="title" :value="competitionIndex" @change="selectCompetition"><view class="picker-value">{{ selectedCompetition?.title || 'Choose competition' }}<text>⌄</text></view></picker>
        <text v-if="selectedCompetition" class="hint">Registration: {{ selectedCompetition.deadlineStatus === 'BeforeDeadline' ? 'Open' : 'Closed' }}</text>
        <text class="label field">Team name</text><input v-model="name" class="input" maxlength="60" placeholder="e.g. Signal Forge" />
        <text class="label field">Team summary</text><textarea v-model="summary" class="textarea" maxlength="300" placeholder="Describe your competition focus and approach." />
        <text class="label field">Team capacity</text><picker :range="capacityOptions" :value="capacityOptions.indexOf(capacity)" @change="selectCapacity"><view class="picker-value">{{ capacity }} people <text>⌄</text></view></picker><text class="hint">The captain counts toward the total. Competition limit: {{ capacityOptions.length }}.</text>
        <text class="label field">Required skills</text><view class="skills"><button v-for="skill in skillOptions" :key="skill" :class="{ active: requiredSkills.includes(skill) }" @click="toggleSkill(skill)">{{ skill }}</button></view>
        <view class="submission"><view><text class="submission__title">Create recruitment now?</text><text class="submission__copy">The first version is submitted for review and is not public until approved.</text></view><switch :checked="submitRecruitment" color="#245ac8" @change="selectRecruitment" /></view>
        <button class="primary" :disabled="saving" @click="createTeam">{{ saving ? 'Creating…' : 'Create team' }}</button>
      </view>
      <view v-if="feedback" class="feedback" :class="{ success: createdTeamId }"><text>{{ feedback }}</text><button v-if="createdTeamId" class="view-teams" @click="openMyTeams">View My Teams</button></view>
    </view><PersonaSwitcher :actors="actors" :selected-id="actorId" overlay :open="labOpen" @select="selectActor" @close="labOpen = false" /><CsBottomNav active="Teams" /></view>
</template>

<style scoped>
.content{max-width:820px;margin:0 auto;padding:28rpx 26rpx 210rpx}.notice,.form-card,.feedback{margin-top:20rpx;padding:26rpx;border-radius:26rpx}.notice{color:#3f3200;background:#ffe5a8}.notice__title,.notice__copy,.label,.hint,.submission__title,.submission__copy,.disclaimer{display:block}.notice__title{font-size:25rpx;font-weight:900}.notice__copy{margin-top:8rpx;font-size:21rpx;line-height:1.5}.form-card{background:#fff;border:1rpx solid #dfe6ee}.label{color:#68778d;font-size:20rpx;font-weight:900;letter-spacing:1.4rpx}.field{margin-top:25rpx}.picker-value,.input,.textarea{width:100%;margin-top:11rpx;padding:20rpx;color:#0a1830;background:#f2f5f8;border:1rpx solid #dce4ed;border-radius:16rpx;font-size:23rpx}.picker-value{display:flex;justify-content:space-between}.textarea{height:160rpx;line-height:1.5}.hint{margin-top:9rpx;color:#718096;font-size:20rpx;line-height:1.4}.skills{display:flex;flex-wrap:wrap;gap:10rpx;margin-top:12rpx}.skills button{margin:0;padding:13rpx 16rpx;color:#52627a;background:#edf1f5;border-radius:999rpx;font-size:20rpx;line-height:1.1}.skills button.active{color:#fff;background:#245ac8;font-weight:850}.submission{display:flex;align-items:center;justify-content:space-between;gap:20rpx;margin-top:28rpx;padding:21rpx;background:#eaf2ff;border-radius:18rpx}.submission__title{font-size:23rpx;font-weight:850}.submission__copy{margin-top:6rpx;color:#526b90;font-size:20rpx;line-height:1.4}.primary{width:100%;margin:24rpx 0 0;padding:22rpx;color:#0a1830;background:#d9ff74;border-radius:18rpx;font-size:24rpx;font-weight:900}.feedback{color:#7b322a;background:#ffeae5;font-size:22rpx;line-height:1.5}.feedback.success{color:#075b49;background:#dff8f1}.feedback button{margin:18rpx 0 0;padding:17rpx;color:#fff;background:#245ac8;border-radius:15rpx;font-size:22rpx;font-weight:850}.disclaimer{margin-top:18rpx;color:#6f7d91;font-size:20rpx;line-height:1.5;text-align:center}@media(min-width:680px){.content{padding:40px 40px 170px}}
.content { max-width: 820px; margin: 0 auto; padding: 20px 16px; padding-bottom: calc(128px + constant(safe-area-inset-bottom)); padding-bottom: calc(128px + env(safe-area-inset-bottom)); }
.intro__title,.intro__copy,.notice__title,.notice__copy,.form-heading,.label,.hint,.submission__title,.submission__copy { display: block; }
.intro__title { color: #14213d; font-size: 26px; font-weight: 780; line-height: 1.2; }
.intro__copy { margin-top: 6px; color: #667085; font-size: 15px; line-height: 1.5; }
.notice { margin-top: 18px; padding: 14px 16px; color: #6f4a00; background: #fff8e7; border: 1px solid #f1dfae; border-radius: 14px; }
.notice__title { font-size: 15px; font-weight: 750; }.notice__copy { margin-top: 3px; font-size: 14px; line-height: 1.45; }
.form-card { margin-top: 14px; padding: 18px; background: #fff; border: 1px solid #dfe4ea; border-radius: 17px; }
.form-heading { margin-bottom: 16px; color: #14213d; font-size: 20px; font-weight: 750; }.label { color: #475467; font-size: 14px; font-weight: 700; }.field { margin-top: 20px; }
.picker-value,.input,.textarea { width: 100%; min-height: 46px; margin-top: 7px; padding: 12px 13px; color: #14213d; background: #f7f9fb; border: 1px solid #dfe4ea; border-radius: 11px; font-size: 15px; }
.picker-value { display: flex; align-items: center; justify-content: space-between; }.textarea { height: 112px; line-height: 1.5; }.hint { margin-top: 6px; color: #667085; font-size: 13px; line-height: 1.4; }
.skills { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 9px; }.skills button { min-height: 40px; margin: 0; padding: 0 11px; color: #475467; background: #eef3f8; border: 1px solid transparent; border-radius: 9px; font-size: 13px; }.skills button.active { color: #1d4ed8; background: #eaf1ff; border-color: #bcd0f2; font-weight: 700; }
.submission { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 22px; padding: 15px; background: #eef4ff; border-radius: 13px; }.submission__title { font-size: 15px; font-weight: 750; }.submission__copy { margin-top: 3px; color: #526581; font-size: 13px; line-height: 1.4; }
.primary { width: 100%; min-height: 48px; margin: 20px 0 0; color: #fff; background: #2563eb; border-radius: 12px; font-size: 15px; font-weight: 700; }.feedback { margin-top: 14px; padding: 15px; color: #8a3c34; background: #fff0ec; border: 1px solid #f1d1ca; border-radius: 14px; font-size: 14px; line-height: 1.5; }.feedback.success { color: #126b57; background: #edf8f4; border-color: #cbe9df; }.feedback button { min-height: 44px; margin: 12px 0 0; padding: 0 14px; color: #fff; background: #2563eb; border-radius: 10px; font-size: 14px; font-weight: 700; }
@media(min-width:680px){.content{padding:28px 40px calc(138px + env(safe-area-inset-bottom));}}
</style>
