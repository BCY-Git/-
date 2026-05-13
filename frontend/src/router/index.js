import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/login', component: () => import('../views/Login.vue'), meta: { public: true } },
  { path: '/sso/callback', component: () => import('../views/SsoCallback.vue'), meta: { public: true } },
  { path: '/', redirect: () => (localStorage.getItem('user')?.includes('admin') ? '/admin/projects' : '/user/submit') },
  { path: '/user/submit', component: () => import('../views/user/UserSubmit.vue'), meta: { role: 'user' } },
  { path: '/user/projects', component: () => import('../views/user/UserProjects.vue'), meta: { role: 'user' } },
  { path: '/admin/suppliers', component: () => import('../views/admin/AdminSuppliers.vue'), meta: { admin: true } },
  { path: '/admin/punishments', component: () => import('../views/admin/AdminPunishments.vue'), meta: { admin: true } },
  { path: '/admin/projects', component: () => import('../views/admin/AdminProjects.vue'), meta: { admin: true } },
  { path: '/admin/lottery-records', component: () => import('../views/admin/AdminLotteryRecords.vue'), meta: { admin: true } },
  { path: '/admin/users', component: () => import('../views/admin/AdminUsers.vue'), meta: { superAdmin: true } }
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.public) return true
  if (!auth.isLoggedIn) return '/login'
  if (to.meta.admin && !auth.isAdmin) return '/user/submit'
  if (to.meta.superAdmin && !auth.isSuperAdmin) return '/admin/projects'
  if (to.meta.role && auth.user?.role !== to.meta.role) return auth.isAdmin ? '/admin/projects' : '/user/submit'
  return true
})

export default router
