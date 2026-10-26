<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { DashboardData } from '../api/client'
import { createAdminApiClient } from '../api/client'

const data = ref<DashboardData | null>(null)
const api = createAdminApiClient()
onMounted(async () => { data.value = await api.getDashboard() })
</script>

<template>
  <div v-if="data" class="dashboard">
    <section class="metric-grid">
      <article class="metric-card metric-card--primary"><span>Published competitions</span><strong>{{ data.competitionCount }}</strong><small>Fictional prototype records</small></article>
      <article class="metric-card"><span>Pending applications</span><strong>{{ data.pendingApplicationCount }}</strong><small>Team decisions remain separate</small></article>
      <article class="metric-card"><span>Active teams</span><strong>{{ data.activeTeamCount }}</strong><small>Mock state only</small></article>
      <article class="metric-card"><span>Moderation queue</span><strong>{{ data.moderationCount }}</strong><small>Revision-aware placeholders</small></article>
    </section>
    <section class="panel-grid">
      <el-card class="panel" shadow="never">
        <template #header>
          <div class="panel__header"><div><span class="kicker">CATALOG SNAPSHOT</span><h2>Competition status</h2></div><el-button type="primary" plain>Open catalog</el-button></div>
        </template>
        <el-table :data="data.competitions" style="width: 100%">
          <el-table-column prop="title" label="Competition" min-width="260" />
          <el-table-column prop="category" label="Category" width="140" />
          <el-table-column label="Deadline status" width="190">
            <template #default="scope"><el-tag :type="scope.row.deadlineStatus === 'BeforeDeadline' ? 'success' : 'info'">{{ scope.row.deadlineStatus }}</el-tag></template>
          </el-table-column>
        </el-table>
      </el-card>
      <el-card class="panel boundary-panel" shadow="never">
        <span class="kicker">DELIVERY BOUNDARY</span><h2>Phase 1 is intentionally narrow</h2>
        <p>This administration shell uses MockTransport. It does not authenticate users, connect to MySQL or perform moderation decisions.</p>
        <ul><li>REST prefix reserved at <code>/api/v1</code></li><li>Application and membership stay distinct</li><li>Recruitment states are modeled independently</li></ul>
      </el-card>
    </section>
  </div>
  <el-skeleton v-else :rows="8" animated />
</template>
