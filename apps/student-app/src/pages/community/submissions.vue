<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { reactive, ref } from 'vue'
import type { CompetitionSubmissionDto, CompetitionSubmissionInput } from '@codestrike/contracts'
import { createStudentApiClient } from '../../api/client'
import { toStatePanel } from '../../api/error-presentation'
import CsHeader from '../../components/CsHeader.vue'
import CsBottomNav from '../../components/CsBottomNav.vue'
import StatePanel from '../../components/StatePanel.vue'

const api = createStudentApiClient()
const rows = ref<CompetitionSubmissionDto[]>([])
const editing = ref<CompetitionSubmissionDto | null>(null)
const formOpen = ref(false)
const blank = () => ({title:'', description:'', category:'', date:'', time:'', eligibilityRules:'', size:'', officialSourceUrl:'', coverImage:''})
const fields = reactive(blank())
const loading = ref(true)
const viewerId = ref('')
const busy = ref(false)
const loadError = ref('')
const error = ref('')
const notice = ref('')

onShow(() => load())
async function load() {
  loadError.value = ''
  loading.value = true
  try {
    if (!api.community) throw new Error('Competition submissions require the API service.')
    const user = await api.restoreSession()
    const id = user?.role === 'Student' ? user.id : ''
    if (viewerId.value !== id) {
      rows.value = []
      formOpen.value = false
      notice.value = ''
      error.value = ''
    }
    viewerId.value = id
    rows.value = id ? await api.community.submissions() : []
  } catch (reason) { loadError.value = toStatePanel(reason).message }
  finally { loading.value = false }
}
function begin(row?: CompetitionSubmissionDto) {
  editing.value = row || null
  Object.assign(fields, blank())
  if (row) {
    const content = row.content
    Object.assign(fields, {
      title: content.title, description: content.description, category: content.category,
      date: content.registrationDeadline.slice(0, 10), time: content.registrationDeadline.slice(11, 16),
      size: String(content.maxTeamSize), eligibilityRules: content.eligibilityRules,
      officialSourceUrl: content.officialSourceUrl, coverImage: content.coverImage || '',
    })
  }
  formOpen.value = true
  error.value = ''
  notice.value = ''
  uni.pageScrollTo({scrollTop: 0, duration: 160})
}
function setDate(event: {detail:{value:string}}) { fields.date = event.detail.value }
function setTime(event: {detail:{value:string}}) { fields.time = event.detail.value }
function payload(): CompetitionSubmissionInput {
  if (![fields.title, fields.description, fields.category, fields.eligibilityRules].every(field => field.trim())) {
    throw new Error('Enter a title, category, description and eligibility rules.')
  }
  if (!fields.date || !fields.time) throw new Error('Choose a registration date and time (UTC).')
  const maxTeamSize = Number(fields.size)
  if (!Number.isInteger(maxTeamSize) || maxTeamSize < 1 || maxTeamSize > 10000) throw new Error('Enter a whole team size from 1 to 10,000.')
  const officialSourceUrl = fields.officialSourceUrl.trim()
  const coverImage = fields.coverImage.trim() || null
  const url = /^https?:\/\/[^\s/]+(?:[/?#]\S*)?$/i
  if (!url.test(officialSourceUrl) || (coverImage && !url.test(coverImage))) throw new Error('Enter full HTTP or HTTPS URLs.')
  const minute = fields.date + 'T' + fields.time
  const previous = editing.value?.content.registrationDeadline
  const registrationDeadline = previous?.startsWith(minute) ? previous : minute + ':00Z'
  return {title:fields.title.trim(), description:fields.description.trim(), category:fields.category.trim(),
    registrationDeadline, maxTeamSize, eligibilityRules:fields.eligibilityRules.trim(), officialSourceUrl, coverImage}
}
async function save() {
  if (busy.value || !api.community) return
  busy.value = true
  error.value = ''
  try {
    const row = await api.community.saveSubmission(payload(), editing.value?.id)
    rows.value = [row, ...rows.value.filter(item => item.id !== row.id)]
    formOpen.value = false
    notice.value = 'Competition submitted for review.'
  } catch (reason) { error.value = toStatePanel(reason).message }
  finally { busy.value = false }
}
function withdraw(row: CompetitionSubmissionDto) {
  if (busy.value || row.deleted || row.competitionId) return
  uni.showModal({title:'Withdraw submission?', content: row.content.title, confirmText:'Withdraw', confirmColor:'#a3312b',
    success: async result => {
      if (!result.confirm || busy.value) return
      busy.value = true
      error.value = ''
      notice.value = ''
      try {
        await api.community!.withdrawSubmission(row.id)
        row.deleted = true
        notice.value = 'Submission withdrawn.'
      } catch (reason) { error.value = toStatePanel(reason).message }
      finally { busy.value = false }
    },
  })
}
function signIn() { uni.navigateTo({url:'/pages/auth/login?back=1'}) }
function openCompetition(id: string) { uni.navigateTo({url:'/pages/competition/detail?id=' + encodeURIComponent(id)}) }
</script>
<template>
  <view class="page-shell">
    <CsHeader back eyebrow="Competitions" title="My submissions" />
    <view class="cm-page cm-stack">
      <StatePanel v-if="loading" title="Loading submissions" message="Getting your competition proposals." />
      <StatePanel v-else-if="loadError" title="Submissions unavailable" :message="loadError" action-label="Try again" @action="load" />
      <StatePanel v-else-if="!viewerId" title="Sign in to submit a competition" message="Your account keeps track of each proposal and its review status." action-label="Sign in" @action="signIn" />
      <template v-else>
        <view v-if="formOpen" class="cm-card">
          <text class="cm-heading">{{ editing ? 'Revise competition' : 'New competition' }}</text>
          <label class="cm-label">Title<input v-model="fields.title" class="cm-input" :maxlength="200" /></label>
          <label class="cm-label">Category<input v-model="fields.category" class="cm-input" :maxlength="100" /></label>
          <label class="cm-label">Description<textarea v-model="fields.description" class="cm-textarea" :maxlength="20000" /></label>
          <label class="cm-label">Eligibility rules<textarea v-model="fields.eligibilityRules" class="cm-textarea" :maxlength="10000" /></label>
          <label class="cm-label">Maximum team size<input v-model="fields.size" class="cm-input" type="number" :maxlength="5" /></label>
          <text class="cm-label">Registration deadline (UTC)</text>
          <view class="cm-row">
            <picker mode="date" :value="fields.date" @change="setDate"><view class="cm-action">{{ fields.date || 'Choose date' }}</view></picker>
            <picker mode="time" :value="fields.time" @change="setTime"><view class="cm-action">{{ fields.time || 'Choose time' }}</view></picker>
          </view>
          <label class="cm-label">Official source URL<input v-model="fields.officialSourceUrl" class="cm-input" :maxlength="2048" /></label>
          <label class="cm-label">Cover image URL (optional)<input v-model="fields.coverImage" class="cm-input" :maxlength="2048" /></label>
          <text v-if="error" class="cm-error" role="alert">{{ error }}</text>
          <button class="cm-primary" :disabled="busy" @click="save">{{ busy ? 'Submitting…' : 'Submit for review' }}</button>
          <button class="cm-action" :disabled="busy" @click="formOpen = false; error = ''">Cancel</button>
        </view>
        <template v-else>
          <button class="cm-primary" @click="begin()">Submit competition</button>
          <text v-if="notice" class="cm-success" role="status">{{ notice }}</text>
          <text v-if="error" class="cm-error" role="alert">{{ error }}</text>
          <StatePanel v-if="!rows.length" compact title="No submissions yet" message="Submit a competition with an official source for review." />
          <view v-for="row in rows" :key="row.id" class="cm-card">
            <text class="cm-meta">{{ row.content.category }} · {{ row.deleted ? 'Withdrawn' : row.status }}</text>
            <text class="cm-heading">{{ row.content.title }}</text>
            <text class="cm-body">{{ row.content.description }}</text>
            <view v-if="!row.deleted && !row.competitionId" class="cm-row">
              <button class="cm-action" :disabled="busy" @click="begin(row)">Revise</button>
              <button class="cm-danger" :disabled="busy" @click="withdraw(row)">Withdraw</button>
            </view>
            <button v-if="row.competitionId" class="cm-action" @click="openCompetition(row.competitionId)">Open competition</button>
          </view>
        </template>
      </template>
    </view>
    <CsBottomNav active="Competitions" />
  </view>
</template>
<style src="../../styles/community.css"></style>
