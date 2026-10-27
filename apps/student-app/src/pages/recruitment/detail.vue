<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import type { RecruitmentDetail } from '@codestrike/contracts'
import CsBottomNav from '../../components/CsBottomNav.vue'
import CsHeader from '../../components/CsHeader.vue'
import StatePanel from '../../components/StatePanel.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import { createStudentApiClient } from '../../api/client'

type DemoPersona = 'Visitor' | 'CompleteStudent'

const api = createStudentApiClient()
const recruitmentId = ref('team-alpha')
const recruitment = ref<RecruitmentDetail | null>(null)
const loading = ref(true)
const errorMessage = ref('')
const persona = ref<DemoPersona>('Visitor')
const applicationCreated = ref(false)

const scenarios = [
  { id: 'team-alpha', label: 'Matched · Open' },
  { id: 'team-beta', label: 'Not matched · Open' },
  { id: 'team-gamma', label: 'Full' },
  { id: 'team-epsilon', label: 'Manually closed' },
  { id: 'team-delta', label: 'Revision delisted' },
  { id: 'team-archive', label: 'Deadline passed' },
]

const actionCopy = computed(() => {
  const item = recruitment.value
  if (!item) return { label: 'Unavailable', reason: 'Recruitment data is unavailable.' }
  if (applicationCreated.value) {
    return { label: 'Application Pending', reason: 'Mock application created. No server request was made.' }
  }
  const values: Record<RecruitmentDetail['availability'], { label: string; reason: string }> = {
    Open: {
      label: 'Apply to join',
      reason:
        item.matchStatus === 'NotMatched'
          ? 'No shared skill tag. You may still apply; matching is advisory only.'
          : 'At least one skill tag overlaps. The captain still makes the decision.',
    },
    Full: { label: 'This team is full.', reason: 'Capacity includes the captain. New applications are blocked.' },
    ManuallyClosed: { label: 'Recruitment closed', reason: 'The captain manually closed new applications.' },
    RegistrationClosed: { label: 'Registration closed', reason: 'The deadline blocks new applications, but the community remains readable.' },
    Delisted: { label: 'Delisted under review', reason: 'A pending recruitment revision removes this listing from public results.' },
  }
  return values[item.availability]
})

const canApply = computed(
  () => recruitment.value?.availability === 'Open' && !applicationCreated.value,
)

onLoad((options) => {
  if (typeof options?.id === 'string' && options.id) recruitmentId.value = options.id
  loadRecruitment(recruitmentId.value)
})

async function loadRecruitment(id: string) {
  recruitmentId.value = id
  loading.value = true
  errorMessage.value = ''
  applicationCreated.value = false
  try {
    recruitment.value = await api.getRecruitment(id)
  } catch (error) {
    recruitment.value = null
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load recruitment.'
  } finally {
    loading.value = false
  }
}

function choosePersona(value: DemoPersona) {
  persona.value = value
  applicationCreated.value = false
}

function handleApply() {
  if (!recruitment.value) return
  if (!canApply.value) {
    uni.showModal({ title: actionCopy.value.label, content: actionCopy.value.reason, showCancel: false })
    return
  }
  if (persona.value === 'Visitor') {
    uni.showModal({
      title: 'Sign in required',
      content: 'This prototype keeps recruitment visible and asks the visitor to sign in before applying. Use the demo persona switcher to continue.',
      showCancel: false,
    })
    return
  }
  applicationCreated.value = true
  uni.showToast({ title: 'Mock application: Pending', icon: 'none' })
}

function showApplicationsBoundary() {
  uni.showModal({
    title: 'Wave 2 scope',
    content: 'Application history and the five-state lifecycle will be implemented in the next prototype wave.',
    showCancel: false,
  })
}

function formatDate(value: string) {
  return value.slice(0, 10)
}
</script>

<template>
  <view class="page-shell">
    <CsHeader back eyebrow="RECRUITMENT DETAIL" :title="recruitment?.name || 'Recruitment'" />

    <view class="content">
      <StatePanel
        v-if="loading"
        title="Loading recruitment"
        message="Resolving the selected deterministic MockTransport scenario."
      />
      <StatePanel
        v-else-if="errorMessage || !recruitment"
        title="Recruitment unavailable"
        :message="errorMessage || 'Recruitment not found.'"
        action-label="Try again"
        @action="loadRecruitment(recruitmentId)"
      />

      <template v-else>
        <view class="scenario-panel">
          <text class="scenario-panel__label">DEMO STATE SWITCHER · PROTOTYPE ONLY</text>
          <scroll-view class="scenario-panel__scroll" scroll-x :show-scrollbar="false">
            <view class="scenario-panel__items">
              <button
                v-for="scenario in scenarios"
                :key="scenario.id"
                class="scenario-chip"
                :class="{ 'scenario-chip--active': recruitment.id === scenario.id }"
                @click="loadRecruitment(scenario.id)"
              >
                {{ scenario.label }}
              </button>
            </view>
          </scroll-view>
        </view>

        <view class="status-card">
          <view class="status-card__badges">
            <StatusBadge
              :label="recruitment.publication === 'Delisted' ? 'DELISTED' : 'PUBLISHED'"
              :tone="recruitment.publication === 'Delisted' ? 'danger' : 'positive'"
            />
            <StatusBadge
              v-if="recruitment.publication === 'Delisted'"
              label="PENDING REVISION"
              tone="warning"
            />
            <StatusBadge
              :label="recruitment.matchStatus === 'Matched' ? 'SKILL MATCHED' : 'NOT MATCHED'"
              :tone="recruitment.matchStatus === 'Matched' ? 'info' : 'neutral'"
            />
          </view>
          <text class="status-card__competition">{{ recruitment.competitionTitle }}</text>
          <text class="status-card__summary">{{ recruitment.summary }}</text>
          <view class="capacity">
            <view class="capacity__header">
              <text>Current membership</text>
              <text>{{ recruitment.memberCount }} / {{ recruitment.capacity }}</text>
            </view>
            <view class="capacity__track"><view class="capacity__fill" :style="{ width: `${(recruitment.memberCount / recruitment.capacity) * 100}%` }" /></view>
            <text class="capacity__note">Captain included in capacity</text>
          </view>
        </view>

        <view class="detail-grid">
          <view class="detail-card">
            <text class="detail-card__label">CAPTAIN</text>
            <text class="detail-card__value">@{{ recruitment.captainUsername }}</text>
            <text class="detail-card__note">Contact details are never shown in public recruitment.</text>
          </view>
          <view class="detail-card">
            <text class="detail-card__label">REGISTRATION DEADLINE</text>
            <text class="detail-card__value">{{ formatDate(recruitment.competitionDeadline) }}</text>
            <text class="detail-card__note">Community access continues after this date.</text>
          </view>
        </view>

        <view class="skills-card">
          <text class="skills-card__label">REQUIRED SKILLS</text>
          <view class="skills-card__items">
            <text v-for="skill in recruitment.requiredSkills" :key="skill" class="skill">{{ skill }}</text>
          </view>
          <text class="skills-card__note">Skill overlap is advisory. Sex and MBTI never influence matching.</text>
        </view>

        <view v-if="recruitment.revisionDraft" class="revision-card">
          <text class="revision-card__label">NOT PUBLIC · REVISION UNDER REVIEW</text>
          <text class="revision-card__title">Effective values remain separate from the draft.</text>
          <view class="revision-columns">
            <view>
              <text class="revision-column__label">EFFECTIVE</text>
              <text class="revision-column__value">{{ recruitment.name }}</text>
              <text class="revision-column__copy">{{ recruitment.capacity }} people · {{ recruitment.requiredSkills.join(', ') }}</text>
            </view>
            <view>
              <text class="revision-column__label">DRAFT</text>
              <text class="revision-column__value">{{ recruitment.revisionDraft.teamName }}</text>
              <text class="revision-column__copy">{{ recruitment.revisionDraft.capacity }} people · {{ recruitment.revisionDraft.requiredSkills.join(', ') }}</text>
            </view>
          </view>
        </view>

        <view class="action-card">
          <view class="persona-switcher">
            <text class="persona-switcher__label">DEMO PERSONA</text>
            <view class="persona-switcher__actions">
              <button :class="{ active: persona === 'Visitor' }" @click="choosePersona('Visitor')">Visitor</button>
              <button :class="{ active: persona === 'CompleteStudent' }" @click="choosePersona('CompleteStudent')">Complete student</button>
            </view>
          </view>
          <view class="action-card__message" :class="{ 'action-card__message--blocked': !canApply }">
            <text class="action-card__message-title">{{ actionCopy.label }}</text>
            <text class="action-card__message-copy">{{ actionCopy.reason }}</text>
          </view>
          <button
            class="apply-button"
            :class="{ 'apply-button--blocked': !canApply }"
            @click="handleApply"
          >
            {{ actionCopy.label }}
          </button>
          <button class="applications-button" @click="showApplicationsBoundary">View my applications</button>
          <text class="mock-disclaimer">Prototype result only. No account, database, or real server workflow is connected.</text>
        </view>
      </template>
    </view>

    <CsBottomNav active="Competitions" />
  </view>
</template>

<style scoped>
.content { max-width: 860px; margin: 0 auto; padding: 28rpx 26rpx 180rpx; }
.scenario-panel { margin-bottom: 22rpx; padding: 22rpx 0 20rpx; color: #dce6f5; background: #13233e; border-radius: 24rpx; }
.scenario-panel__label { display: block; padding: 0 24rpx; color: #d9ff74; font-size: 16rpx; font-weight: 900; letter-spacing: 2rpx; }
.scenario-panel__scroll { margin-top: 18rpx; white-space: nowrap; }
.scenario-panel__items { display: inline-flex; gap: 10rpx; padding: 0 24rpx; }
.scenario-chip { margin: 0; padding: 15rpx 18rpx; color: #c8d4e5; background: rgba(255,255,255,.08); border: 1rpx solid rgba(255,255,255,.13); border-radius: 999rpx; font-size: 18rpx; line-height: 1.1; }
.scenario-chip--active { color: #0a1830; background: #fff; border-color: #fff; font-weight: 850; }
.status-card,.detail-card,.skills-card,.action-card { padding: 28rpx; background: #fff; border: 1rpx solid #dfe6ee; border-radius: 28rpx; }
.status-card__badges { display: flex; flex-wrap: wrap; gap: 10rpx; }
.status-card__competition { display: block; margin-top: 24rpx; color: #245ac8; font-size: 20rpx; font-weight: 800; }
.status-card__summary { display: block; margin-top: 12rpx; color: #3d4b62; font-size: 24rpx; line-height: 1.6; }
.capacity { margin-top: 28rpx; padding-top: 24rpx; border-top: 1rpx solid #e6ebf1; }
.capacity__header { display: flex; justify-content: space-between; color: #223149; font-size: 21rpx; font-weight: 800; }
.capacity__track { height: 14rpx; margin-top: 15rpx; overflow: hidden; background: #e8edf2; border-radius: 999rpx; }
.capacity__fill { height: 100%; background: #5fddc4; border-radius: inherit; }
.capacity__note { display: block; margin-top: 10rpx; color: #8490a1; font-size: 18rpx; }
.detail-grid { display: grid; grid-template-columns: 1fr; gap: 18rpx; margin-top: 20rpx; }
.detail-card__label,.detail-card__value,.detail-card__note,.skills-card__label,.skills-card__note { display: block; }
.detail-card__label,.skills-card__label { color: #8490a1; font-size: 17rpx; font-weight: 900; letter-spacing: 2rpx; }
.detail-card__value { margin-top: 13rpx; color: #0a1830; font-size: 27rpx; font-weight: 850; }
.detail-card__note,.skills-card__note { margin-top: 10rpx; color: #718095; font-size: 20rpx; line-height: 1.45; }
.skills-card { margin-top: 20rpx; }
.skills-card__items { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 18rpx; }
.skill { padding: 11rpx 16rpx; color: #193f78; background: #e6f0ff; border-radius: 13rpx; font-size: 20rpx; font-weight: 800; }
.revision-card { margin-top: 20rpx; padding: 28rpx; color: #fae9e6; background: #582f31; border-radius: 28rpx; }
.revision-card__label,.revision-card__title,.revision-column__label,.revision-column__value,.revision-column__copy { display: block; }
.revision-card__label { color: #ffb4a4; font-size: 17rpx; font-weight: 900; letter-spacing: 2rpx; }
.revision-card__title { margin-top: 12rpx; color: #fff; font-size: 27rpx; font-weight: 850; line-height: 1.35; }
.revision-columns { display: grid; grid-template-columns: 1fr; gap: 14rpx; margin-top: 22rpx; }
.revision-columns > view { padding: 20rpx; background: rgba(255,255,255,.08); border-radius: 18rpx; }
.revision-column__label { color: #ffb4a4; font-size: 16rpx; font-weight: 900; letter-spacing: 1rpx; }
.revision-column__value { margin-top: 10rpx; color: #fff; font-size: 23rpx; font-weight: 850; }
.revision-column__copy { margin-top: 7rpx; font-size: 18rpx; line-height: 1.45; }
.action-card { margin-top: 20rpx; }
.persona-switcher__label { display: block; color: #7f8c9e; font-size: 17rpx; font-weight: 900; letter-spacing: 2rpx; }
.persona-switcher__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10rpx; margin-top: 14rpx; }
.persona-switcher__actions button { margin: 0; padding: 16rpx 8rpx; color: #617086; background: #edf1f5; border-radius: 14rpx; font-size: 19rpx; line-height: 1.2; }
.persona-switcher__actions button.active { color: #fff; background: #245ac8; font-weight: 850; }
.action-card__message { margin-top: 24rpx; padding: 20rpx; background: #e3faf4; border-radius: 18rpx; }
.action-card__message--blocked { background: #fff1de; }
.action-card__message-title,.action-card__message-copy { display: block; }
.action-card__message-title { color: #0a1830; font-size: 22rpx; font-weight: 850; }
.action-card__message-copy { margin-top: 7rpx; color: #647287; font-size: 19rpx; line-height: 1.5; }
.apply-button,.applications-button { width: 100%; margin: 18rpx 0 0; padding: 22rpx 24rpx; border-radius: 18rpx; font-size: 23rpx; font-weight: 850; line-height: 1.2; }
.apply-button { color: #0a1830; background: #d9ff74; }
.apply-button--blocked { color: #704331; background: #ffd8c8; }
.applications-button { color: #245ac8; background: #e8f0ff; }
.mock-disclaimer { display: block; margin-top: 18rpx; color: #8a95a5; font-size: 18rpx; line-height: 1.45; text-align: center; }
@media (min-width: 680px) {
  .content { padding: 40px 40px 150px; }
  .detail-grid,.revision-columns { grid-template-columns: 1fr 1fr; }
}
</style>
