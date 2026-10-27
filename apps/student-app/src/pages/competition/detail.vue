<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import type {
  CompetitionDetail,
  RecruitmentSummary,
} from '@codestrike/contracts'
import CsBottomNav from '../../components/CsBottomNav.vue'
import CsHeader from '../../components/CsHeader.vue'
import RecruitmentCard from '../../components/RecruitmentCard.vue'
import StatePanel from '../../components/StatePanel.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import { createStudentApiClient } from '../../api/client'

type CommunityTab = 'Overview' | 'Discussion' | 'Resources' | 'Recruitment'

const api = createStudentApiClient()
const competitionId = ref('competition-demo-1')
const competition = ref<CompetitionDetail | null>(null)
const recruitments = ref<RecruitmentSummary[]>([])
const activeTab = ref<CommunityTab>('Overview')
const loading = ref(true)
const errorMessage = ref('')

const tabs: CommunityTab[] = ['Overview', 'Discussion', 'Resources', 'Recruitment']
const isExpired = computed(() => competition.value?.deadlineStatus === 'AfterDeadline')

onLoad((options) => {
  if (typeof options?.id === 'string' && options.id) competitionId.value = options.id
  if (options?.tab === 'Recruitment') activeTab.value = 'Recruitment'
  loadPage()
})

async function loadPage() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [detail, recruitmentItems] = await Promise.all([
      api.getCompetition(competitionId.value),
      api.listRecruitments(competitionId.value),
    ])
    competition.value = detail
    recruitments.value = recruitmentItems
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load this community.'
  } finally {
    loading.value = false
  }
}

function selectTab(tab: CommunityTab) {
  activeTab.value = tab
}

function openRecruitment(id: string) {
  uni.navigateTo({ url: `/pages/recruitment/detail?id=${id}` })
}

function copyOfficialSource() {
  if (!competition.value) return
  uni.setClipboardData({
    data: competition.value.officialSourceUrl,
    success: () =>
      uni.showToast({ title: 'Official source link copied', icon: 'none' }),
  })
}

function showPostBoundary() {
  uni.showModal({
    title: 'Prototype boundary',
    content: 'Post creation and profile completeness checks are planned for a later wave.',
    showCancel: false,
  })
}

function previewDelistedRecruitment() {
  uni.navigateTo({ url: '/pages/recruitment/detail?id=team-delta&prototypePreview=1' })
}

function formatDate(value: string) {
  return value.slice(0, 10)
}
</script>

<template>
  <view class="page-shell">
    <CsHeader back eyebrow="COMPETITION COMMUNITY" :title="competition?.title || 'Competition detail'" />

    <view class="content">
      <StatePanel
        v-if="loading"
        title="Loading competition community"
        message="Fetching competition and recruitment fixtures through MockTransport."
      />
      <StatePanel
        v-else-if="errorMessage || !competition"
        title="Community unavailable"
        :message="errorMessage || 'Competition not found.'"
        action-label="Try again"
        @action="loadPage"
      />

      <template v-else>
        <view v-if="isExpired" class="deadline-banner">
          <view>
            <text class="deadline-banner__label">REGISTRATION CLOSED</text>
            <text class="deadline-banner__title">The community remains open.</text>
          </view>
          <text class="deadline-banner__copy">Existing discussions, resources, teams, and recruitment history stay available. New admissions are blocked.</text>
        </view>

        <view class="identity-card">
          <view class="identity-card__rail">
            <StatusBadge label="PUBLISHED" tone="positive" />
            <StatusBadge
              :label="isExpired ? 'REGISTRATION CLOSED' : 'REGISTRATION OPEN'"
              :tone="isExpired ? 'warning' : 'info'"
            />
          </view>
          <text class="identity-card__description">{{ competition.description }}</text>
          <view class="identity-card__stats">
            <view><text class="stat__value">{{ competition.community.discussionCount }}</text><text class="stat__label">Discussions</text></view>
            <view><text class="stat__value">{{ competition.community.resourceCount }}</text><text class="stat__label">Resources</text></view>
            <view><text class="stat__value">{{ competition.maximumTeamSize }}</text><text class="stat__label">Max team</text></view>
          </view>
        </view>

        <scroll-view class="tabs" scroll-x :show-scrollbar="false">
          <view class="tabs__inner">
            <button
              v-for="tab in tabs"
              :key="tab"
              class="tabs__item"
              :class="{ 'tabs__item--active': activeTab === tab }"
              @click="selectTab(tab)"
            >
              {{ tab }}
            </button>
          </view>
        </scroll-view>

        <view v-if="activeTab === 'Overview'" class="panel-stack">
          <view class="info-card">
            <text class="info-card__kicker">COMPETITION BRIEF</text>
            <view class="info-row"><text class="info-row__label">Category</text><text class="info-row__value">{{ competition.category }}</text></view>
            <view class="info-row"><text class="info-row__label">Eligibility</text><text class="info-row__value">{{ competition.eligibility }}</text></view>
            <view class="info-row"><text class="info-row__label">Deadline</text><text class="info-row__value">{{ formatDate(competition.registrationDeadline) }}</text></view>
            <view class="info-row"><text class="info-row__label">Maximum team size</text><text class="info-row__value">{{ competition.maximumTeamSize }} people, captain included</text></view>
            <button class="primary-action" @click="copyOfficialSource">Copy official source link</button>
          </view>
          <button class="next-card" @click="selectTab('Recruitment')">
            <view><text class="next-card__kicker">NEXT</text><text class="next-card__title">Browse recruitment</text></view>
            <text class="next-card__arrow">›</text>
          </button>
        </view>

        <view v-else-if="activeTab === 'Discussion'" class="panel-stack">
          <view class="community-card">
            <text class="community-card__meta">PINNED · EXPERIENCE</text>
            <text class="community-card__title">How we scoped our first prototype week</text>
            <text class="community-card__copy">A fictional approved discussion item. Public author labels use usernames and expose no contact details.</text>
          </view>
          <button class="secondary-action" @click="showPostBoundary">Write a post</button>
        </view>

        <view v-else-if="activeTab === 'Resources'" class="panel-stack">
          <view class="community-card">
            <text class="community-card__meta">RESOURCE · APPROVED</text>
            <text class="community-card__title">Campus innovation submission checklist</text>
            <text class="community-card__copy">External reference link placeholder using fictional content for prototype review.</text>
          </view>
        </view>

        <view v-else class="panel-stack">
          <view class="section-title">
            <view><text class="section-title__kicker">PUBLIC RECRUITMENT</text><text class="section-title__text">Find a team</text></view>
            <text class="section-title__count">{{ recruitments.length }}</text>
          </view>
          <StatePanel
            v-if="recruitments.length === 0"
            compact
            title="No published recruitment"
            message="The community remains available even when no team is recruiting."
          />
          <RecruitmentCard
            v-for="item in recruitments"
            :key="item.id"
            :recruitment="item"
            @open="openRecruitment"
          />
          <view v-if="competition.id === 'competition-demo-1'" class="prototype-preview">
            <text class="prototype-preview__label">PROTOTYPE-ONLY MODERATION PREVIEW</text>
            <text class="prototype-preview__title">Pending revision · Delisted</text>
            <text class="prototype-preview__copy">Team Delta is excluded from the public list above. Open this controlled preview to inspect effective and draft values.</text>
            <button class="prototype-preview__button" @click="previewDelistedRecruitment">Preview delisted state</button>
          </view>
        </view>
      </template>
    </view>

    <CsBottomNav active="Competitions" />
  </view>
</template>

<style scoped>
.content { max-width: 920px; margin: 0 auto; padding: 28rpx 26rpx 180rpx; }
.deadline-banner { margin-bottom: 22rpx; padding: 26rpx; color: #402b00; background: #ffd879; border-radius: 24rpx; }
.deadline-banner__label,.deadline-banner__title,.deadline-banner__copy { display: block; }
.deadline-banner__label { font-size: 18rpx; font-weight: 900; letter-spacing: 2rpx; }
.deadline-banner__title { margin-top: 8rpx; font-size: 28rpx; font-weight: 850; }
.deadline-banner__copy { margin-top: 12rpx; font-size: 21rpx; line-height: 1.5; }
.identity-card,.info-card,.community-card { padding: 28rpx; background: #fff; border: 1rpx solid #dfe6ee; border-radius: 28rpx; }
.identity-card__rail { display: flex; flex-wrap: wrap; gap: 10rpx; }
.identity-card__description { display: block; margin-top: 22rpx; color: #445269; font-size: 23rpx; line-height: 1.6; }
.identity-card__stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 10rpx; margin-top: 26rpx; padding-top: 24rpx; border-top: 1rpx solid #e5eaf0; }
.identity-card__stats > view { min-width: 0; }
.stat__value,.stat__label { display: block; }
.stat__value { color: #0a1830; font-size: 31rpx; font-weight: 900; }
.stat__label { margin-top: 5rpx; color: #7e8a9b; font-size: 17rpx; }
.tabs { margin: 30rpx -26rpx 28rpx; white-space: nowrap; }
.tabs__inner { display: inline-flex; gap: 10rpx; padding: 0 26rpx; }
.tabs__item { margin: 0; padding: 18rpx 24rpx; color: #69768a; background: #e9eef3; border-radius: 999rpx; font-size: 21rpx; font-weight: 750; line-height: 1.1; }
.tabs__item--active { color: #fff; background: #0a1830; }
.panel-stack { display: flex; flex-direction: column; gap: 20rpx; }
.info-card__kicker,.community-card__meta,.section-title__kicker { display: block; color: #758296; font-size: 18rpx; font-weight: 900; letter-spacing: 2rpx; }
.info-row { display: grid; grid-template-columns: 190rpx 1fr; gap: 18rpx; padding: 22rpx 0; border-bottom: 1rpx solid #e7ecf2; }
.info-row__label { color: #7b8799; font-size: 20rpx; }
.info-row__value { color: #1b2940; font-size: 21rpx; font-weight: 650; line-height: 1.5; }
.primary-action,.secondary-action { width: 100%; margin: 28rpx 0 0; padding: 22rpx 26rpx; border-radius: 18rpx; font-size: 23rpx; font-weight: 850; line-height: 1.2; }
.primary-action { color: #0a1830; background: #d9ff74; }
.secondary-action { color: #fff; background: #245ac8; }
.next-card { display: flex; align-items: center; justify-content: space-between; width: 100%; margin: 0; padding: 28rpx; text-align: left; color: #fff; background: #245ac8; border-radius: 26rpx; }
.next-card__kicker,.next-card__title { display: block; }
.next-card__kicker { color: #bcd2ff; font-size: 17rpx; font-weight: 900; letter-spacing: 2rpx; }
.next-card__title { margin-top: 8rpx; font-size: 28rpx; font-weight: 850; }
.next-card__arrow { font-size: 52rpx; }
.community-card__title { display: block; margin-top: 16rpx; color: #0a1830; font-size: 29rpx; font-weight: 850; line-height: 1.35; }
.community-card__copy { display: block; margin-top: 12rpx; color: #68758a; font-size: 22rpx; line-height: 1.55; }
.section-title { display: flex; align-items: flex-end; justify-content: space-between; margin: 8rpx 2rpx 4rpx; }
.section-title__text { display: block; margin-top: 7rpx; color: #0a1830; font-size: 34rpx; font-weight: 850; }
.section-title__count { color: #a0aaba; font-size: 36rpx; font-weight: 850; }
.prototype-preview { padding: 28rpx; color: #dce6f5; background: #13233e; border-radius: 26rpx; }
.prototype-preview__label,.prototype-preview__title,.prototype-preview__copy { display: block; }
.prototype-preview__label { color: #ff9b83; font-size: 17rpx; font-weight: 900; letter-spacing: 2rpx; }
.prototype-preview__title { margin-top: 12rpx; color: #fff; font-size: 28rpx; font-weight: 850; }
.prototype-preview__copy { margin-top: 10rpx; font-size: 20rpx; line-height: 1.55; }
.prototype-preview__button { margin: 24rpx 0 0; padding: 17rpx 20rpx; color: #0a1830; background: #fff; border-radius: 15rpx; font-size: 20rpx; font-weight: 850; line-height: 1.2; }
@media (min-width: 680px) {
  .content { padding: 40px 40px 150px; }
  .identity-card__stats { max-width: 560px; }
  .panel-stack { gap: 22px; }
}
</style>
