import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import { api, live, sessionUser } from '../api/runtime'
import { toElementFeedback } from '../api/error-feedback'
import { ADMIN_TOKEN_KEY } from '../api/token-store'
import { adminReturnPath } from './navigation'
import DashboardView from '../views/DashboardView.vue'
import PlaceholderView from '../views/PlaceholderView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: DashboardView, meta: { title: 'Dashboard' } },
    { path: '/competitions', component: live ? () => import('../views/CompetitionsView.vue') : PlaceholderView, meta: { title: 'Competition management' } },
    { path: '/moderation', component: live ? () => import('../views/ModerationView.vue') : PlaceholderView, meta: { title: 'Moderation queue' } },
    ...(live ? [{ path: '/login', component: () => import('../views/LoginView.vue') }] : []),
  ],
})

if (live) {
  router.beforeEach(async to => {
    // A redirect from a failed restoration has already checked this token.
    if (to.path === '/login' && to.redirectedFrom && !sessionUser.value) return true
    try {
      if (await api.restoreSession()) {
        return to.path === '/login' ? adminReturnPath(to.query.next) : true
      }
    } catch (error) {
      ElMessage(toElementFeedback(error))
    }
    return to.path === '/login' || { path: '/login', query: { next: to.fullPath }, replace: true }
  })

  window.addEventListener('storage', async event => {
    if (event.key !== ADMIN_TOKEN_KEY && event.key !== null) return
    const current = router.currentRoute.value
    sessionUser.value = null
    try {
      if (await api.restoreSession()) {
        if (current.path === '/login') await router.replace(adminReturnPath(current.query.next))
        return
      }
    } catch (error) {
      ElMessage(toElementFeedback(error))
    }
    if (current.path !== '/login') await router.replace({ path: '/login', query: { next: current.fullPath } })
  })
}
