<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { CompetitionDetailDto } from '@codestrike/contracts'
import type { CompetitionFields } from '../api/client'
import { api } from '../api/runtime'
import { toElementFeedback } from '../api/error-feedback'

const props = defineProps<{ record: CompetitionDetailDto | null }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const row = props.record
const initial: CompetitionFields = {
  title: row?.title ?? '', description: row?.description ?? '', category: row?.category ?? '',
  registrationDeadline: row?.registrationDeadline ?? '', eligibilityRules: row?.eligibilityRules ?? '',
  maxTeamSize: row?.maxTeamSize ?? 1, officialSourceUrl: row?.officialSourceUrl ?? '',
  coverImage: row?.coverImage ?? null, published: row?.published ?? false,
}
const draft = reactive({ ...initial })
const deadline = computed({
  get: () => draft.registrationDeadline ? new Date(draft.registrationDeadline) : null,
  set: (value: Date | null) => { draft.registrationDeadline = value?.toISOString() ?? '' },
})
const busy = ref(false)
const failure = ref('')

async function save() {
  if (busy.value) return
  if (!draft.registrationDeadline) {
    failure.value = 'Choose a registration deadline.'
    return
  }
  busy.value = true
  failure.value = ''
  try {
    const fields = { ...draft, coverImage: draft.coverImage?.trim() || null }
    if (row) {
      const keys = Object.keys(fields) as (keyof CompetitionFields)[]
      const changes = Object.fromEntries(keys.filter(key => fields[key] !== initial[key]).map(key => [key, fields[key]]))
      if (Object.keys(changes).length) await api.updateCompetition(row.id, changes)
    } else {
      await api.createCompetition(fields)
    }
    ElMessage.success(row ? 'Competition saved.' : 'Competition created.')
    emit('saved')
  } catch (error) {
    failure.value = toElementFeedback(error).message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <el-dialog :model-value="true" :title="row ? 'Edit competition' : 'Create competition'" width="min(680px, 94vw)"
    :close-on-click-modal="false" :close-on-press-escape="!busy" :show-close="!busy" @close="emit('close')">
    <el-form label-position="top" :disabled="busy" @submit.prevent="save">
      <el-form-item label="Title"><el-input v-model="draft.title" maxlength="200" required /></el-form-item>
      <div class="form-grid">
        <el-form-item label="Category"><el-input v-model="draft.category" maxlength="100" required /></el-form-item>
        <el-form-item label="Maximum team size"><el-input-number v-model="draft.maxTeamSize" :min="1" :max="10000" :precision="0" /></el-form-item>
      </div>
      <el-form-item label="Registration deadline (local time)"><el-date-picker v-model="deadline" type="datetime" placeholder="Select date and time" /></el-form-item>
      <el-form-item label="Description"><el-input v-model="draft.description" type="textarea" :rows="3" maxlength="20000" required /></el-form-item>
      <el-form-item label="Eligibility rules"><el-input v-model="draft.eligibilityRules" type="textarea" maxlength="10000" required /></el-form-item>
      <el-form-item label="Official source URL"><el-input v-model="draft.officialSourceUrl" type="url" maxlength="2048" required /></el-form-item>
      <el-form-item label="Cover image URL (optional)"><el-input :model-value="draft.coverImage ?? ''" type="url" maxlength="2048" @update:model-value="draft.coverImage = $event || null" /></el-form-item>
      <el-form-item label="Publication"><el-switch v-model="draft.published" active-text="Published" inactive-text="Draft" /></el-form-item>
      <el-alert v-if="failure" :title="failure" type="error" :closable="false" />
      <div class="toolbar form-actions">
        <el-button @click="emit('close')">Cancel</el-button>
        <el-button type="primary" native-type="submit" :loading="busy">{{ row ? 'Save changes' : 'Create competition' }}</el-button>
      </div>
    </el-form>
  </el-dialog>
</template>
