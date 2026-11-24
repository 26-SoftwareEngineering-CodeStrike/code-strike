<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { api, live, sessionUser } from './api/runtime'
import { toElementFeedback } from './api/error-feedback'
const route = useRoute()
const router = useRouter()
const signingOut = ref(false)

watch(sessionUser, (user, previous) => {
  if (!user && previous && !signingOut.value && route.path !== '/login') {
    void router.replace({ path: '/login', query: { next: route.fullPath } })
  }
})

async function logout() {
  signingOut.value = true
  try {
    await api.signOut()
    ElMessage.success('Signed out.')
  } catch (error) {
    ElMessage(toElementFeedback(error))
  } finally {
    await router.replace('/login')
    signingOut.value = false
  }
}
</script>

<template>
  <router-view v-if="live && route.path === '/login'" />
  <el-container v-else-if="!live || sessionUser" class="admin-shell" :key="sessionUser?.id">
    <el-aside class="admin-shell__aside" width="248px">
      <div class="brand">
        <div class="brand__mark">CS</div>
        <div><strong>CodeStrike</strong><span>Administration</span></div>
      </div>
      <el-menu class="side-menu" :default-active="route.path" router>
        <el-menu-item index="/"><span class="menu-index">01</span><span>Dashboard</span></el-menu-item>
        <el-menu-item index="/competitions"><span class="menu-index">02</span><span>Competitions</span></el-menu-item>
        <el-menu-item index="/moderation"><span class="menu-index">03</span><span>Moderation</span></el-menu-item>
      </el-menu>
      <div v-if="!live" class="prototype-label">MOCK PROTOTYPE · PHASE 1</div>
    </el-aside>
    <el-container>
      <el-header class="topbar">
        <div>
          <span class="topbar__eyebrow">Campus Competition & Activity Community</span>
          <h1>{{ route.meta.title ?? 'Dashboard' }}</h1>
        </div>
        <div v-if="live" class="toolbar"><span>{{ sessionUser?.username }}</span><el-button :loading="signingOut" @click="logout">Sign out</el-button></div>
        <el-tag v-else effect="plain" type="info">Admin demo</el-tag>
      </el-header>
      <el-main class="content-area"><router-view /></el-main>
    </el-container>
  </el-container>
</template>
