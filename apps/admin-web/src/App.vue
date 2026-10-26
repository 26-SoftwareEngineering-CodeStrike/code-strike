<script setup lang="ts">
import { useRoute } from 'vue-router'
const route = useRoute()
</script>

<template>
  <el-container class="admin-shell">
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
      <div class="prototype-label">MOCK PROTOTYPE · PHASE 1</div>
    </el-aside>
    <el-container>
      <el-header class="topbar">
        <div>
          <span class="topbar__eyebrow">Campus Competition & Activity Community</span>
          <h1>{{ route.meta.title ?? 'Dashboard' }}</h1>
        </div>
        <el-tag effect="plain" type="info">Admin demo</el-tag>
      </el-header>
      <el-main class="content-area"><router-view /></el-main>
    </el-container>
  </el-container>
</template>
