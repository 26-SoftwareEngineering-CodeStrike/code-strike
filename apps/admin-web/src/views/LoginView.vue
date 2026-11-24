<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api/runtime'
import { toElementFeedback } from '../api/error-feedback'
import { adminReturnPath } from '../router/navigation'

const route = useRoute()
const router = useRouter()
const username = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')

async function submit() {
  if (busy.value) return
  error.value = ''
  busy.value = true
  try {
    await api.signIn({ username: username.value.trim(), password: password.value })
    password.value = ''
    await router.replace(adminReturnPath(route.query.next))
  } catch (failure) {
    error.value = toElementFeedback(failure).message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <el-card class="login-panel" shadow="never">
      <div class="brand__mark">CS</div>
      <h1>Administrator sign in</h1>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="Username"><el-input v-model="username" required autocomplete="username" maxlength="64" /></el-form-item>
        <el-form-item label="Password"><el-input v-model="password" required type="password" show-password autocomplete="current-password" maxlength="128" /></el-form-item>
        <el-alert v-if="error" :title="error" type="error" :closable="false" />
        <el-button type="primary" native-type="submit" :loading="busy">Sign in</el-button>
      </el-form>
    </el-card>
  </main>
</template>
