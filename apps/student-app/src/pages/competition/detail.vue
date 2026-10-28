<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import type { CompetitionDetail, RecruitmentSummary } from '@codestrike/contracts'
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

onLoad((options) => { if (typeof options?.id === 'string' && options.id) competitionId.value = options.id; if (options?.tab === 'Recruitment') activeTab.value = 'Recruitment'; loadPage() })
async function loadPage() { loading.value = true; errorMessage.value = ''; try { const [detail, recruitmentItems] = await Promise.all([api.getCompetition(competitionId.value), api.listRecruitments(competitionId.value)]); competition.value = detail; recruitments.value = recruitmentItems } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Unable to load this community.' } finally { loading.value = false } }
function selectTab(tab: CommunityTab) { activeTab.value = tab }
function openRecruitment(id: string) { uni.navigateTo({ url: `/pages/recruitment/detail?id=${id}` }) }
function copyOfficialSource() { if (!competition.value) return; uni.setClipboardData({ data: competition.value.officialSourceUrl, success: () => uni.showToast({ title: 'Official source link copied', icon: 'none' }) }) }
function showPostBoundary() { uni.showModal({ title: 'Posting is not available yet', content: 'Post creation is outside this pilot. Published discussions remain available to browse.', showCancel: false }) }
const formatDate = (value: string) => value.slice(0, 10)
</script>

<template>
  <view class="page-shell">
    <CsHeader back eyebrow="Competition community" :title="competition?.title || 'Competition'" />
    <view class="content">
      <StatePanel v-if="loading" title="Loading competition" message="Getting competition and community details." />
      <StatePanel v-else-if="errorMessage || !competition" title="Community unavailable" :message="errorMessage || 'Competition not found.'" action-label="Try again" @action="loadPage" />
      <template v-else>
        <view v-if="isExpired" class="deadline-banner"><view><text class="deadline-banner__title">Registration has closed</text><text class="deadline-banner__copy">The community, resources and recruitment history remain available.</text></view><StatusBadge label="Closed" tone="warning" /></view>
        <view class="identity">
          <view class="identity__rail"><text class="identity__category">{{ competition.category }}</text><StatusBadge :label="isExpired ? 'Registration closed' : 'Registration open'" :tone="isExpired ? 'warning' : 'positive'" /></view>
          <text class="identity__title">{{ competition.title }}</text>
          <text class="identity__description">{{ competition.description }}</text>
          <view class="identity__stats"><view><text class="stat__value">{{ competition.community.discussionCount }}</text><text class="stat__label">Discussion posts</text></view><view><text class="stat__value">{{ competition.community.resourceCount }}</text><text class="stat__label">Shared resources</text></view><view><text class="stat__value">{{ competition.maximumTeamSize }}</text><text class="stat__label">Team limit</text></view></view>
        </view>

        <view class="tabs" role="tablist" aria-label="Competition community sections"><view class="tabs__inner"><button v-for="tab in tabs" :key="tab" class="tabs__item" :class="{ 'tabs__item--active': activeTab === tab }" :aria-selected="activeTab === tab" @click="selectTab(tab)">{{ tab }}</button></view></view>

        <view v-if="activeTab === 'Overview'" class="panel-stack">
          <view class="info-list"><view class="info-row"><text class="info-row__label">Eligibility</text><text class="info-row__value">{{ competition.eligibility }}</text></view><view class="info-row"><text class="info-row__label">Deadline</text><text class="info-row__value">{{ formatDate(competition.registrationDeadline) }}</text></view><view class="info-row"><text class="info-row__label">Team size</text><text class="info-row__value">Up to {{ competition.maximumTeamSize }} people, including the captain</text></view><button class="source-action" @click="copyOfficialSource">Copy official source link</button></view>
          <button class="next-card" @click="selectTab('Recruitment')"><view><text class="next-card__title">Find a team</text><text class="next-card__copy">Browse published recruitment for this competition</text></view><text class="next-card__arrow">›</text></button>
        </view>
        <view v-else-if="activeTab === 'Discussion'" class="panel-stack"><view class="community-item"><text class="community-item__meta">Pinned experience</text><text class="community-item__title">How we scoped our first prototype week</text><text class="community-item__copy">A published discussion shared with this competition community.</text></view><button class="secondary-action" @click="showPostBoundary">Write a post</button></view>
        <view v-else-if="activeTab === 'Resources'" class="panel-stack"><view class="community-item"><text class="community-item__meta">Approved resource</text><text class="community-item__title">Campus innovation submission checklist</text><text class="community-item__copy">A reference shared with students preparing their submission.</text></view></view>
        <view v-else class="panel-stack"><view class="section-title"><text>Recruiting teams</text><text>{{ recruitments.length }}</text></view><StatePanel v-if="recruitments.length === 0" compact title="No published recruitment" message="The community remains available even when no team is recruiting." /><RecruitmentCard v-for="item in recruitments" :key="item.id" :recruitment="item" @open="openRecruitment" /></view>
      </template>
    </view>
    <CsBottomNav active="Competitions" />
  </view>
</template>

<style scoped>
.content { max-width: 920px; margin: 0 auto; padding: 18px 16px; padding-bottom: calc(128px + constant(safe-area-inset-bottom)); padding-bottom: calc(128px + env(safe-area-inset-bottom)); }
.deadline-banner { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 14px; padding: 15px; color: #6f4a00; background: #fff8e7; border: 1px solid #f1dfae; border-radius: 14px; }.deadline-banner__title,.deadline-banner__copy { display: block; }.deadline-banner__title { font-size: 16px; font-weight: 750; }.deadline-banner__copy { margin-top: 3px; font-size: 14px; line-height: 1.45; }
.identity { padding: 4px 2px 0; }.identity__rail { display: flex; align-items: center; justify-content: space-between; gap: 12px; }.identity__category { color: #667085; font-size: 13px; font-weight: 700; }.identity__title { display: block; margin-top: 14px; overflow-wrap: anywhere; color: #14213d; font-size: 24px; font-weight: 780; line-height: 1.25; letter-spacing: -.02em; }.identity__description { display: block; margin-top: 8px; color: #344054; font-size: 16px; line-height: 1.55; }.identity__stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-top: 18px; }.identity__stats > view { padding: 12px; background: #fff; border: 1px solid #e1e6ec; border-radius: 12px; }.stat__value,.stat__label { display: block; }.stat__value { color: #14213d; font-size: 20px; font-weight: 780; }.stat__label { margin-top: 2px; color: #667085; font-size: 12px; }
.tabs { margin: 22px 0 18px; border: 1px solid #e1e6ec; border-radius: 14px; background: #fff; }.tabs__inner { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 0; width: 100%; padding: 5px 2px; }.tabs__item { min-width: 0; min-height: 44px; margin: 0; padding: 0; overflow: hidden; color: #667085; background: transparent; border-radius: 10px; font-size: 12px; font-weight: 650; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }.tabs__item--active { color: #14213d; background: #eef3f8; box-shadow: inset 0 -2px #2563eb; }
.panel-stack { display: flex; flex-direction: column; gap: 13px; }.info-list,.community-item { padding: 18px; background: #fff; border: 1px solid #dfe4ea; border-radius: 16px; }.info-row { display: grid; grid-template-columns: 92px 1fr; gap: 12px; padding: 13px 0; border-bottom: 1px solid #e7ebf0; }.info-row:first-child { padding-top: 0; }.info-row__label { color: #667085; font-size: 14px; }.info-row__value { color: #344054; font-size: 15px; font-weight: 600; line-height: 1.45; }.source-action,.secondary-action { width: 100%; min-height: 46px; margin: 15px 0 0; color: #fff; background: #2563eb; border-radius: 12px; font-size: 15px; font-weight: 700; }
.next-card { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 0; margin: 0; padding: 17px 18px; text-align: left; color: #14213d; background: #eaf1ff; border: 1px solid #cfddf7; border-radius: 15px; }.next-card__title,.next-card__copy { display: block; }.next-card__title { font-size: 18px; font-weight: 750; }.next-card__copy { margin-top: 3px; color: #526581; font-size: 14px; }.next-card__arrow { color: #2563eb; font-size: 28px; }
.community-item__meta,.community-item__title,.community-item__copy { display: block; }.community-item__meta { color: #667085; font-size: 13px; font-weight: 700; }.community-item__title { margin-top: 9px; color: #14213d; font-size: 19px; font-weight: 750; line-height: 1.35; }.community-item__copy { margin-top: 7px; color: #667085; font-size: 15px; line-height: 1.5; }
.section-title { display: flex; align-items: center; justify-content: space-between; padding: 2px; color: #14213d; font-size: 20px; font-weight: 750; }.section-title text:last-child { color: #667085; font-size: 14px; }
@media (min-width: 680px) { .content { padding: 26px 40px calc(138px + env(safe-area-inset-bottom)); }.identity__stats { max-width: 600px; }.panel-stack { gap: 16px; }.tabs { margin-right: 0; margin-left: 0; border: 1px solid #e1e6ec; border-radius: 14px; } }
@media (max-width: 340px) { .identity__stats > view { padding: 10px 8px; }.info-row { grid-template-columns: 78px 1fr; } }
</style>
