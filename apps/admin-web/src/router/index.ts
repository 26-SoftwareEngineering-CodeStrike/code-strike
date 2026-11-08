import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import PlaceholderView from '../views/PlaceholderView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: DashboardView, meta: { title: 'Dashboard' } },
    { path: '/competitions', component: PlaceholderView, meta: { title: 'Competition management' } },
    { path: '/moderation', component: PlaceholderView, meta: { title: 'Moderation queue' } },
  ],
})
