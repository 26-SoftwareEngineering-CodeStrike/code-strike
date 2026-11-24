<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { DashboardData } from '@codestrike/contracts'
import { api, live } from '../api/runtime'
import { toElementFeedback } from '../api/error-feedback'

const data = ref<DashboardData | null>(null)
const loading = ref(true)
const failure = ref('')
async function refresh() {
  loading.value = true
  failure.value = ''
  try {
    data.value = await api.getDashboard()
  } catch (error) {
    const feedback = toElementFeedback(error)
    failure.value = feedback.message
    ElMessage(feedback)
  } finally {
    loading.value = false
  }
}
onMounted(refresh)
</script>

<template>
  <div v-if="live" class="toolbar section-tools"><el-button :loading="loading" @click="refresh">Refresh dashboard</el-button></div>
  <el-alert v-if="failure" :title="failure" type="error" :closable="false" />
  <div v-if="data" class="dashboard">
    <section class="metric-grid">
      <article class="metric-card metric-card--primary"><span>{{ live ? 'Competitions' : 'Published competitions' }}</span><strong>{{ data.competitionCount }}</strong><small v-if="!live">Fictional prototype records</small></article>
      <article class="metric-card"><span>Pending applications</span><strong>{{ data.pendingApplicationCount }}</strong><small v-if="!live">Team decisions remain separate</small></article>
      <article class="metric-card"><span>Active teams</span><strong>{{ data.activeTeamCount }}</strong><small v-if="!live">Mock state only</small></article>
      <article class="metric-card"><span>Moderation queue</span><strong>{{ data.moderationCount }}</strong><router-link v-if="live" to="/moderation">Review queue</router-link><small v-else>Revision-aware placeholders</small></article>
    </section>
    <section class="panel-grid" :class="{ 'panel-grid--live': live }">
      <el-card class="panel" shadow="never">
        <template #header>
          <div class="panel__header"><div><span v-if="!live" class="kicker">CATALOG SNAPSHOT</span><h2>{{ live ? 'Published competitions' : 'Competition status' }}</h2></div><el-button type="primary" plain @click="live && $router.push('/competitions')">Open catalog</el-button></div>
        </template>
        <el-table :data="data.competitions" style="width: 100%">
          <el-table-column prop="title" label="Competition" min-width="260" />
          <el-table-column prop="category" label="Category" width="140" />
          <el-table-column label="Deadline status" width="190">
            <template #default="scope"><el-tag :type="scope.row.deadlineStatus === 'BeforeDeadline' ? 'success' : 'info'">{{ scope.row.deadlineStatus }}</el-tag></template>
          </el-table-column>
        </el-table>
      </el-card>
      <el-card v-if="!live" class="panel boundary-panel" shadow="never">
        <span class="kicker">DELIVERY BOUNDARY</span><h2>Phase 1 is intentionally narrow</h2>
        <p>This administration shell uses MockTransport. It does not authenticate users, connect to MySQL or perform moderation decisions.</p>
        <ul><li>REST prefix reserved at <code>/api/v1</code></li><li>Application and membership stay distinct</li><li>Recruitment states are modeled independently</li></ul>
      </el-card>
    </section>
  </div>
  <el-skeleton v-else-if="loading" :rows="8" animated />
</template>
