<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  actionsFor,
  revisionStatuses,
  type Action,
  type Payload,
  type Queue,
  type Revision,
  type RevisionKind,
  type RevisionStatus,
} from '../api/moderation'
import { api } from '../api/runtime'
import { toElementFeedback } from '../api/error-feedback'
import { usePage } from './use-page'

interface ImageEntry {
  loading: boolean
  url?: string
  error?: string
}

const queues: { value: Queue; label: string }[] = [
  { value: 'Content', label: 'Content' },
  { value: 'Competition', label: 'Competition submissions' },
  { value: 'Recruitment', label: 'Recruitments' },
]

const route = useRoute()
const router = useRouter()

function parseQueue(value: unknown): Queue {
  return value === 'Competition' || value === 'Recruitment' ? value : 'Content'
}

function parseStatus(value: unknown): RevisionStatus {
  return typeof value === 'string' && (revisionStatuses as readonly string[]).includes(value)
    ? (value as RevisionStatus)
    : 'Pending'
}

const queue = ref<Queue>(parseQueue(route.query.queue))
const status = ref<RevisionStatus>(parseStatus(route.query.status))
const pageSize = 20

const { items, offsets, nextOffset, loading, error, previous, next, refresh, reset } = usePage(
  offset => api.listRevisions(queue.value, status.value, offset, pageSize),
)

const dialogOpen = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const detail = shallowRef<Revision | null>(null)
const reason = ref('')
const decisionError = ref('')
const submitting = ref(false)
const images = ref<Record<string, ImageEntry>>({})

let inspectGeneration = 0
const objectUrls: string[] = []

function clearImages() {
  for (const url of objectUrls.splice(0)) URL.revokeObjectURL(url)
  images.value = {}
}

onBeforeUnmount(() => {
  inspectGeneration++
  clearImages()
})

watch(
  () => [route.query.queue, route.query.status],
  ([nextQueue, nextStatus]) => {
    const parsedQueue = parseQueue(nextQueue)
    const parsedStatus = parseStatus(nextStatus)
    if (parsedQueue === queue.value && parsedStatus === status.value) return
    queue.value = parsedQueue
    status.value = parsedStatus
    void reset()
  },
)

function selectFilters(nextQueue: Queue, nextStatus: RevisionStatus) {
  const changed = nextQueue !== queue.value || nextStatus !== status.value
  queue.value = nextQueue
  status.value = nextStatus
  void router.replace({ path: '/moderation', query: { queue: nextQueue, status: nextStatus } })
  if (changed) void reset()
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function imageIdsOf(payload?: Payload): string[] {
  return payload ? asStringList(payload.imageIds) : []
}

function summaryOf(row: Revision): string {
  const p = row.proposed
  if (row.kind === 'Post') {
    const text = asText(p.text).trim()
    if (text) return text
    const links = asStringList(p.links)
    if (links.length) return links[0]
    const count = imageIdsOf(p).length
    return count ? `Image post (${count})` : 'Post revision'
  }
  if (row.kind === 'Comment') return asText(p.text).trim() || 'Comment revision'
  if (row.kind === 'Competition') return asText(p.title).trim() || 'Competition submission'
  const parts = [asText(p.name).trim(), asText(p.summary).trim()].filter(Boolean)
  return parts.join(' — ') || 'Recruitment revision'
}

function subjectOf(row: Revision): string {
  const p = row.proposed
  if (row.kind === 'Post' || row.kind === 'Comment') return asText(p.username) || row.targetId
  if (row.kind === 'Competition') return asText(p.category) || row.targetId
  return row.targetId
}

function formatDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function formatSkills(payload: Payload): string {
  if (Array.isArray(payload.skills)) {
    return payload.skills
      .map(item => (item && typeof item === 'object' && 'name' in item ? String(item.name) : String(item)))
      .join(', ')
  }
  const ids = asStringList(payload.skillIds)
  return ids.join(', ')
}

function entriesFor(kind: RevisionKind, payload: Payload): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  const push = (label: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return
    rows.push({ label, value: String(value) })
  }
  if (kind === 'Post') {
    push('Author', payload.username)
    push('Text', payload.text)
    const links = asStringList(payload.links)
    if (links.length) push('Links', links.join('\n'))
    push('Competition ID', payload.competitionId)
    push('Likes / Favorites', payload.likes !== undefined ? `${payload.likes} / ${payload.favorites ?? 0}` : '')
    push('Created', formatDate(payload.createdAt))
  } else if (kind === 'Comment') {
    push('Author', payload.username)
    push('Text', payload.text)
    push('Post ID', payload.postId)
    push('Parent comment', payload.parentId)
    push('Created', formatDate(payload.createdAt))
  } else if (kind === 'Competition') {
    push('Title', payload.title)
    push('Category', payload.category)
    push('Maximum team size', payload.maxTeamSize)
    push('Registration deadline', formatDate(payload.registrationDeadline))
    push('Description', payload.description)
    push('Eligibility rules', payload.eligibilityRules)
    push('Official source URL', payload.officialSourceUrl)
    push('Cover image URL', payload.coverImage)
  } else {
    push('Team name', payload.name)
    push('Summary', payload.summary)
    push('Capacity', payload.capacity)
    push('Skills', formatSkills(payload))
    push('Publication', payload.publication)
    push('Recruitment switch', payload.recruitmentSwitch)
    push('Lifecycle', payload.lifecycle)
    push('Active members', payload.memberCount)
  }
  return rows
}

function statusTagType(value: RevisionStatus): 'warning' | 'success' | 'danger' | 'info' {
  if (value === 'Pending') return 'warning'
  if (value === 'Approved') return 'success'
  if (value === 'Rejected') return 'danger'
  return 'info'
}

const availableActions = computed<Action[]>(() => (detail.value ? actionsFor(detail.value) : []))

const needsReasonForNegative = computed(() => detail.value !== null && detail.value.kind !== 'Recruitment')

async function loadPostImages(revision: Revision, generation: number) {
  if (revision.kind !== 'Post') return
  const ids = Array.from(new Set([...imageIdsOf(revision.proposed), ...imageIdsOf(revision.effective)]))
  if (!ids.length) return
  const initial: Record<string, ImageEntry> = {}
  for (const id of ids) initial[id] = { loading: true }
  images.value = initial
  await Promise.all(
    ids.map(async id => {
      try {
        const blob = await api.getPostImage(id)
        if (generation !== inspectGeneration) return
        const url = URL.createObjectURL(blob)
        objectUrls.push(url)
        images.value = { ...images.value, [id]: { loading: false, url } }
      } catch (failure) {
        if (generation !== inspectGeneration) return
        images.value = { ...images.value, [id]: { loading: false, error: toElementFeedback(failure).message } }
      }
    }),
  )
}

async function inspect(row: Revision) {
  const generation = ++inspectGeneration
  clearImages()
  dialogOpen.value = true
  detailLoading.value = true
  detailError.value = ''
  decisionError.value = ''
  reason.value = ''
  detail.value = null
  try {
    const full = await api.getRevision(row)
    if (generation !== inspectGeneration) return
    detail.value = full
    void loadPostImages(full, generation)
  } catch (failure) {
    if (generation === inspectGeneration) detailError.value = toElementFeedback(failure).message
  } finally {
    if (generation === inspectGeneration) detailLoading.value = false
  }
}

function closeDialog() {
  if (submitting.value) return
  inspectGeneration++
  clearImages()
  dialogOpen.value = false
  detail.value = null
  detailError.value = ''
  decisionError.value = ''
  reason.value = ''
}

function actionButtonType(action: Action): 'primary' | 'warning' | 'danger' {
  if (action === 'Approve') return 'primary'
  if (action === 'Reject') return 'warning'
  return 'danger'
}

async function applyDecision(action: Action) {
  if (submitting.value || !detail.value) return
  submitting.value = true
  decisionError.value = ''
  try {
    await api.decide(detail.value, action, reason.value)
    const past = action === 'Approve' ? 'approved' : action === 'Reject' ? 'rejected' : 'removed'
    ElMessage.success(`${detail.value.kind} revision ${past}.`)
    submitting.value = false
    closeDialog()
    await refresh()
  } catch (failure) {
    decisionError.value = toElementFeedback(failure).message
    submitting.value = false
  }
}
</script>

<template>
  <el-card class="panel" shadow="never">
    <template #header>
      <div class="panel__header">
        <h2>Moderation queue</h2>
        <div class="toolbar">
          <el-button :loading="loading" @click="refresh">Refresh</el-button>
        </div>
      </div>
    </template>

    <div class="moderation-filters">
      <div class="toolbar" role="group" aria-label="Moderation queue type">
        <el-button
          v-for="item in queues"
          :key="item.value"
          :type="queue === item.value ? 'primary' : 'default'"
          :plain="queue !== item.value"
          @click="selectFilters(item.value, status)"
        >
          {{ item.label }}
        </el-button>
      </div>
      <div class="toolbar" role="group" aria-label="Revision status">
        <el-button
          v-for="state in revisionStatuses"
          :key="state"
          size="small"
          :type="status === state ? 'primary' : 'default'"
          :plain="status !== state"
          @click="selectFilters(queue, state)"
        >
          {{ state }}
        </el-button>
      </div>
    </div>

    <el-alert v-if="error" :title="error" type="error" :closable="false" />

    <el-table v-loading="loading" :data="items" row-key="revisionId" empty-text="No revisions in this queue">
      <el-table-column label="Kind" width="130">
        <template #default="{ row }">
          <el-tag effect="plain">{{ row.kind }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="Summary" min-width="260">
        <template #default="{ row }">
          <div class="summary-cell">{{ summaryOf(row) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="Author / target" min-width="150">
        <template #default="{ row }">{{ subjectOf(row) }}</template>
      </el-table-column>
      <el-table-column label="Status" width="200">
        <template #default="{ row }">
          <div class="toolbar tag-list">
            <el-tag :type="statusTagType(row.status)">{{ row.status }}</el-tag>
            <el-tag v-if="row.removed" type="danger" effect="plain">Removed</el-tag>
            <el-tag v-if="row.deleted" type="info" effect="plain">Deleted</el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="Actions" width="120">
        <template #default="{ row }">
          <el-button link type="primary" @click="inspect(row)">Inspect</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="toolbar pager">
      <el-button :disabled="loading || offsets.length === 1" @click="previous">Previous</el-button>
      <span>Page {{ offsets.length }}</span>
      <el-button :disabled="loading || nextOffset === null" @click="next">Next</el-button>
    </div>
  </el-card>

  <el-dialog
    :model-value="dialogOpen"
    :title="detail ? `Review ${detail.kind} revision` : 'Review revision'"
    width="min(840px, 95vw)"
    :close-on-click-modal="false"
    :close-on-press-escape="!submitting"
    :show-close="!submitting"
    @close="closeDialog"
  >
    <el-skeleton v-if="detailLoading" :rows="6" animated />
    <el-alert v-else-if="detailError" :title="detailError" type="error" :closable="false" />
    <div v-else-if="detail" class="revision-detail">
      <div class="toolbar tag-list">
        <el-tag effect="plain">{{ detail.kind }}</el-tag>
        <el-tag :type="statusTagType(detail.status)">{{ detail.status }}</el-tag>
        <el-tag v-if="detail.removed" type="danger" effect="plain">Removed</el-tag>
        <el-tag v-if="detail.deleted" type="info" effect="plain">Deleted</el-tag>
        <span class="meta-id">Revision <code>{{ detail.revisionId }}</code></span>
        <span class="meta-id">Target <code>{{ detail.targetId }}</code></span>
      </div>

      <el-alert
        v-if="detail.reason"
        :title="`Recorded reason: ${detail.reason}`"
        type="info"
        :closable="false"
      />

      <div class="revision-grid" :class="{ 'revision-grid--single': !detail.effective }">
        <section class="revision-panel revision-panel--proposed">
          <h3>Proposed revision</h3>
          <dl class="revision-fields">
            <template v-for="entry in entriesFor(detail.kind, detail.proposed)" :key="entry.label">
              <dt>{{ entry.label }}</dt>
              <dd>{{ entry.value }}</dd>
            </template>
          </dl>
          <div v-if="imageIdsOf(detail.proposed).length" class="revision-images">
            <div v-for="(id, index) in imageIdsOf(detail.proposed)" :key="id" class="revision-image-item">
              <span v-if="images[id]?.loading" class="meta-id">Loading image {{ index + 1 }}…</span>
              <el-alert v-else-if="images[id]?.error" :title="images[id].error" type="error" :closable="false" />
              <img
                v-else-if="images[id]?.url"
                class="revision-thumb"
                :src="images[id].url"
                :alt="`Proposed image ${index + 1}`"
              />
            </div>
          </div>
        </section>

        <section v-if="detail.effective" class="revision-panel revision-panel--effective">
          <h3>Currently effective</h3>
          <dl class="revision-fields">
            <template v-for="entry in entriesFor(detail.kind, detail.effective)" :key="entry.label">
              <dt>{{ entry.label }}</dt>
              <dd>{{ entry.value }}</dd>
            </template>
          </dl>
          <div v-if="imageIdsOf(detail.effective).length" class="revision-images">
            <div v-for="(id, index) in imageIdsOf(detail.effective)" :key="id" class="revision-image-item">
              <span v-if="images[id]?.loading" class="meta-id">Loading image {{ index + 1 }}…</span>
              <el-alert v-else-if="images[id]?.error" :title="images[id].error" type="error" :closable="false" />
              <img
                v-else-if="images[id]?.url"
                class="revision-thumb"
                :src="images[id].url"
                :alt="`Effective image ${index + 1}`"
              />
            </div>
          </div>
        </section>
      </div>

      <section v-if="detail.history?.length" class="revision-history">
        <h3>Revision history</h3>
        <ul>
          <li v-for="item in detail.history" :key="item.revisionId">
            <code>{{ item.revisionId }}</code>
            <el-tag size="small" :type="statusTagType(item.status)">{{ item.status }}</el-tag>
            <span>{{ formatDate(item.createdAt) }}</span>
          </li>
        </ul>
      </section>

      <section v-if="availableActions.length" class="decision-box">
        <el-form label-position="top" :disabled="submitting" @submit.prevent>
          <el-form-item
            :label="needsReasonForNegative ? 'Review reason (required for Reject or Remove)' : 'Review reason (optional)'"
          >
            <el-input
              v-model="reason"
              type="textarea"
              :rows="2"
              maxlength="1000"
              placeholder="Enter moderation notes or reason"
            />
          </el-form-item>
        </el-form>
        <el-alert v-if="decisionError" :title="decisionError" type="error" :closable="false" />
        <div class="toolbar form-actions">
          <el-button :disabled="submitting" @click="closeDialog">Close</el-button>
          <el-button
            v-for="action in availableActions"
            :key="action"
            :type="actionButtonType(action)"
            :loading="submitting"
            @click="applyDecision(action)"
          >
            {{ action }}
          </el-button>
        </div>
      </section>

      <template v-else>
        <el-alert
          title="No further moderation actions are available for this revision."
          type="info"
          :closable="false"
        />
        <div class="toolbar form-actions">
          <el-button @click="closeDialog">Close</el-button>
        </div>
      </template>
    </div>
  </el-dialog>
</template>
