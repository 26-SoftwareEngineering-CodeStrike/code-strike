<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { CompetitionDetailDto } from '@codestrike/contracts'
import { api } from '../api/runtime'
import { toElementFeedback } from '../api/error-feedback'
import CompetitionEditor from './CompetitionEditor.vue'
import { usePage } from './use-page'

const search = ref('')
let query = ''
const pageSize = 20
const { items, offsets, nextOffset, loading, error, previous, next, refresh, reset } = usePage(async offset => {
  const rows = await api.listCompetitions(query, offset, pageSize + 1)
  return { items: rows.slice(0, pageSize), nextOffset: rows.length > pageSize ? offset + pageSize : null }
})
const editing = shallowRef<CompetitionDetailDto | null>(null)
const editorOpen = ref(false)
const busy = ref(false)

function filter() {
  query = search.value.trim()
  void reset()
}
function edit(row: CompetitionDetailDto | null) {
  editing.value = row
  editorOpen.value = true
}
async function saved() {
  editorOpen.value = false
  if (editing.value) await refresh()
  else {
    search.value = ''
    filter()
  }
}
async function remove(row: CompetitionDetailDto) {
  try {
    await ElMessageBox.confirm('Delete “' + row.title + '”?', 'Delete competition', {
      type: 'warning', confirmButtonText: 'Delete', cancelButtonText: 'Cancel',
    })
  } catch { return }
  busy.value = true
  try {
    await api.deleteCompetition(row.id)
    ElMessage.success('Competition deleted.')
  } catch (failure) {
    ElMessage(toElementFeedback(failure))
  } finally {
    await refresh()
    busy.value = false
  }
}
</script>

<template>
  <el-card class="panel" shadow="never">
    <template #header>
      <div class="panel__header"><h2>Competition catalog</h2>
        <div class="toolbar">
          <el-button @click="$router.push({ path: '/moderation', query: { queue: 'Competition', status: 'Pending' } })">Review submissions</el-button>
          <el-button type="primary" @click="edit(null)">Create competition</el-button>
        </div>
      </div>
    </template>
    <form class="toolbar section-tools" @submit.prevent="filter">
      <el-input v-model="search" clearable maxlength="200" aria-label="Search competition titles" placeholder="Search competition titles" @clear="filter" />
      <el-button native-type="submit">Search</el-button>
      <el-button :loading="loading" @click="refresh">Refresh</el-button>
    </form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table v-loading="loading" :data="items" row-key="id" empty-text="No competitions found">
      <el-table-column prop="title" label="Competition" min-width="200" />
      <el-table-column prop="category" label="Category" min-width="110" />
      <el-table-column label="Registration deadline" min-width="170"><template #default="{ row }">{{ new Date(row.registrationDeadline).toLocaleString() }}</template></el-table-column>
      <el-table-column label="Publication" width="110"><template #default="{ row }"><el-tag :type="row.published ? 'success' : 'info'">{{ row.published ? 'Published' : 'Draft' }}</el-tag></template></el-table-column>
      <el-table-column label="Actions" width="155"><template #default="{ row }">
        <el-button link type="primary" :disabled="busy" @click="edit(row)">View / edit</el-button>
        <el-button link type="danger" :disabled="busy" @click="remove(row)">Delete</el-button>
      </template></el-table-column>
    </el-table>
    <div class="toolbar pager">
      <el-button :disabled="loading || offsets.length === 1" @click="previous">Previous</el-button>
      <span>Page {{ offsets.length }}</span>
      <el-button :disabled="loading || nextOffset === null" @click="next">Next</el-button>
    </div>
  </el-card>
  <CompetitionEditor v-if="editorOpen" :record="editing" @close="editorOpen = false" @saved="saved" />
</template>
