<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import type { NotificationDto } from '@codestrike/contracts'
import { createStudentApiClient } from '../../api/client'
import { toStatePanel } from '../../api/error-presentation'
import {
  notificationCategory,
  notificationLabel,
  notificationTargetUrl,
} from '../../api/notifications'
import CsBottomNav from '../../components/CsBottomNav.vue'
import CsHeader from '../../components/CsHeader.vue'
import StatePanel from '../../components/StatePanel.vue'
import StatusBadge from '../../components/StatusBadge.vue'

const api = createStudentApiClient()
const pageSize = 50

const items = ref<NotificationDto[]>([])
const unreadCount = ref(0)
const filter = ref<'All' | 'Unread'>('All')
const signedIn = ref(false)
const loading = ref(true)
const loadingMore = ref(false)
const hasMore = ref(false)
const busyId = ref('')
const errorTitle = ref('')
const errorMessage = ref('')
const notice = ref('')

let generation = 0

const visibleItems = computed(() =>
  filter.value === 'Unread' ? items.value.filter((item) => !item.isRead) : items.value,
)

onShow(() => {
  void load()
})

async function load() {
  const request = ++generation
  loading.value = true
  errorTitle.value = ''
  errorMessage.value = ''
  notice.value = ''
  if (!api.notifications) {
    signedIn.value = false
    items.value = []
    unreadCount.value = 0
    hasMore.value = false
    loading.value = false
    errorTitle.value = 'API backend required'
    errorMessage.value = 'Notifications are available when connected to the CodeStrike API backend.'
    return
  }
  try {
    const user = await api.restoreSession()
    if (request !== generation) return
    signedIn.value = user !== null
    if (!user) {
      items.value = []
      unreadCount.value = 0
      hasMore.value = false
      return
    }
    const inbox = await api.notifications.inbox(0, pageSize)
    if (request !== generation) return
    items.value = inbox.items
    unreadCount.value = inbox.unreadCount
    hasMore.value = inbox.items.length === pageSize
  } catch (error) {
    if (request !== generation) return
    const panel = toStatePanel(error)
    errorTitle.value = panel.title
    errorMessage.value = panel.message
  } finally {
    if (request === generation) loading.value = false
  }
}

async function loadMore() {
  if (!api.notifications || loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  errorMessage.value = ''
  try {
    const inbox = await api.notifications.inbox(items.value.length, pageSize)
    const seen = new Set(items.value.map((item) => item.id))
    items.value = [...items.value, ...inbox.items.filter((item) => !seen.has(item.id))]
    unreadCount.value = inbox.unreadCount
    hasMore.value = inbox.items.length === pageSize
  } catch (error) {
    const panel = toStatePanel(error)
    errorTitle.value = panel.title
    errorMessage.value = panel.message
  } finally {
    loadingMore.value = false
  }
}

async function toggleRead(item: NotificationDto) {
  if (!api.notifications || busyId.value) return
  busyId.value = item.id
  notice.value = ''
  try {
    const updated = await api.notifications.setRead(item.id, !item.isRead)
    items.value = items.value.map((row) => (row.id === updated.id ? updated : row))
    unreadCount.value = Math.max(0, unreadCount.value + (updated.isRead ? -1 : 1))
    notice.value = updated.isRead ? 'Marked notification as read.' : 'Marked notification as unread.'
  } catch (error) {
    notice.value = toStatePanel(error).message
  } finally {
    busyId.value = ''
  }
}

async function openTarget(item: NotificationDto) {
  const url = notificationTargetUrl(item)
  if (!url) return
  if (!item.isRead && api.notifications && !busyId.value) {
    busyId.value = item.id
    try {
      const updated = await api.notifications.setRead(item.id, true)
      items.value = items.value.map((row) => (row.id === updated.id ? updated : row))
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    } catch {
      // Destination navigation still proceeds; server reauthorizes target access.
    } finally {
      busyId.value = ''
    }
  }
  uni.navigateTo({ url })
}

function signIn() {
  uni.navigateTo({ url: '/pages/auth/login' })
}

function formatCreatedAt(value: string): string {
  if (!value) return ''
  return value.replace('T', ' ').slice(0, 16)
}

function categoryTone(event: string): 'positive' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (event.includes('Approve') || event === 'MemberJoined') return 'positive'
  if (event.includes('Reject') || event.includes('Remove') || event.includes('Dissolved') || event.includes('Invalidated')) {
    return 'danger'
  }
  if (event === 'NewApplication') return 'info'
  return 'neutral'
}
</script>

<template>
  <view class="page-shell">
    <CsHeader back eyebrow="Inbox" title="Notifications" />
    <view class="content">
      <view class="head">
        <view>
          <text class="head__title">Your updates</text>
          <text class="head__copy">Admission decisions, team changes and moderation notices appear here.</text>
        </view>
        <text v-if="signedIn" class="unread-pill">{{ unreadCount }} unread</text>
      </view>

      <StatePanel v-if="loading" title="Loading notifications" message="Checking your inbox." />
      <StatePanel
        v-else-if="errorMessage && !items.length"
        :title="errorTitle || 'Notifications unavailable'"
        :message="errorMessage"
        action-label="Try again"
        @action="load"
      />
      <StatePanel
        v-else-if="!signedIn"
        title="Sign in to view notifications"
        message="Notifications are private to your signed-in account."
        action-label="Sign in"
        @action="signIn"
      />
      <template v-else>
        <view class="toolbar">
          <view class="tabs">
            <button :class="{ active: filter === 'All' }" @click="filter = 'All'">
              All ({{ items.length }})
            </button>
            <button :class="{ active: filter === 'Unread' }" @click="filter = 'Unread'">
              Unread ({{ unreadCount }})
            </button>
          </view>
          <button class="refresh" :disabled="loading" @click="load">Refresh</button>
        </view>

        <text v-if="notice" class="notice" role="status">{{ notice }}</text>
        <text v-if="errorMessage" class="error-banner" role="alert">{{ errorMessage }}</text>

        <StatePanel
          v-if="visibleItems.length === 0"
          compact
          :title="filter === 'Unread' ? 'No unread notifications' : 'No notifications yet'"
          :message="
            filter === 'Unread'
              ? 'You have read all current notifications.'
              : 'Team admission decisions and content moderation results will appear here.'
          "
        />

        <view v-else class="list">
          <view
            v-for="item in visibleItems"
            :key="item.id"
            class="card"
            :class="{ 'card--unread': !item.isRead }"
          >
            <view class="card__top">
              <view class="card__badges">
                <view v-if="!item.isRead" class="dot" aria-hidden="true" />
                <StatusBadge
                  :label="notificationCategory(item.event).toUpperCase()"
                  :tone="categoryTone(item.event)"
                />
                <text class="card__state">{{ item.isRead ? 'Read' : 'Unread' }}</text>
              </view>
              <text class="card__time">{{ formatCreatedAt(item.createdAt) }}</text>
            </view>
            <text class="card__title">{{ notificationLabel(item.event) }}</text>
            <text class="card__message">{{ item.message }}</text>
            <view class="card__actions">
              <button
                class="secondary"
                :disabled="busyId === item.id"
                @click="toggleRead(item)"
              >
                {{ item.isRead ? 'Mark unread' : 'Mark as read' }}
              </button>
              <button
                v-if="notificationTargetUrl(item)"
                class="primary"
                :disabled="busyId === item.id"
                @click="openTarget(item)"
              >
                Open related page
              </button>
            </view>
          </view>
        </view>

        <button
          v-if="hasMore"
          class="load-more"
          :disabled="loadingMore"
          @click="loadMore"
        >
          {{ loadingMore ? 'Loading more…' : 'Load more notifications' }}
        </button>
      </template>
    </view>
    <CsBottomNav active="Me" />
  </view>
</template>

<style scoped>
.content { max-width: 900px; margin: 0 auto; padding: 20px 16px; padding-bottom: calc(128px + constant(safe-area-inset-bottom)); padding-bottom: calc(128px + env(safe-area-inset-bottom)); }
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.head__title, .head__copy, .card__title, .card__message, .card__time, .card__state, .notice, .error-banner { display: block; }
.head__title { color: #14213d; font-size: 26px; font-weight: 780; line-height: 1.2; }
.head__copy { margin-top: 6px; color: #667085; font-size: 15px; line-height: 1.45; }
.unread-pill { flex: 0 0 auto; padding: 6px 10px; color: #1e56b3; background: #eef4ff; border: 1px solid #c7dafc; border-radius: 9px; font-size: 13px; font-weight: 750; font-variant-numeric: tabular-nums; }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-top: 18px; }
.tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; flex: 1 1 220px; padding: 5px; background: #fff; border: 1px solid #dfe4ea; border-radius: 13px; }
.tabs button { display: flex; align-items: center; justify-content: center; min-height: 44px; margin: 0; padding: 0 10px; color: #667085; background: transparent; border-radius: 9px; font-size: 14px; font-weight: 700; line-height: 1.2; }
.tabs button.active { color: #14213d; background: #eaf1ff; box-shadow: inset 0 -2px #2563eb; }
.refresh { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; margin: 0; padding: 0 14px; color: #344054; background: #fff; border: 1px solid #dfe4ea; border-radius: 12px; font-size: 14px; font-weight: 700; line-height: 1.2; }
.notice { margin-top: 12px; padding: 10px 12px; color: #126b57; background: #edf8f4; border: 1px solid #cbe9df; border-radius: 10px; font-size: 14px; }
.error-banner { margin-top: 12px; padding: 10px 12px; color: #8a302b; background: #fff0ee; border: 1px solid #f4cbc6; border-radius: 10px; font-size: 14px; }
.list { display: grid; gap: 12px; margin-top: 14px; }
.card { padding: 16px; background: #fff; border: 1px solid #dfe4ea; border-radius: 16px; }
.card--unread { border-left: 4px solid #2563eb; background: #fcfdff; }
.card__top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.card__badges { display: flex; align-items: center; gap: 8px; }
.dot { width: 8px; height: 8px; background: #2563eb; border-radius: 50%; }
.card__state { color: #667085; font-size: 12px; font-weight: 700; }
.card__time { color: #8993a4; font-size: 12px; font-variant-numeric: tabular-nums; }
.card__title { margin-top: 10px; color: #14213d; font-size: 17px; font-weight: 750; line-height: 1.3; }
.card__message { margin-top: 6px; color: #344054; font-size: 15px; line-height: 1.5; }
.card__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.card__actions button { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; margin: 0; padding: 0 14px; border-radius: 10px; font-size: 14px; font-weight: 700; line-height: 1.2; }
.secondary { color: #1e56b3; background: #eef4ff; }
.primary { color: #fff; background: #2563eb; }
.load-more { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 46px; margin-top: 14px; color: #1e56b3; background: #eef4ff; border-radius: 12px; font-size: 14px; font-weight: 700; line-height: 1.2; }
@media (min-width: 680px) { .content { padding: 28px 40px calc(138px + env(safe-area-inset-bottom)); } }
@media (max-width: 380px) { .head { display: block; } .unread-pill { display: inline-block; margin-top: 10px; } }
</style>
