<template>
  <router-view v-if="isLoginPage" />
  <div v-else class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <strong>供应商轮候抽取系统</strong>
        <span>{{ roleLabel }}</span>
      </div>
      <nav class="nav-list">
        <router-link v-if="auth.user?.role === 'user'" class="nav-link" to="/user/submit">
          <FilePlus :size="18" /> 提交项目
        </router-link>
        <router-link v-if="auth.user?.role === 'user'" class="nav-link" to="/user/projects">
          <FolderClock :size="18" /> 抽取记录
        </router-link>
        <router-link v-if="auth.isAdmin" class="nav-link" to="/admin/projects">
          <ClipboardList :size="18" /> 项目记录
        </router-link>
        <router-link v-if="auth.isAdmin" class="nav-link" to="/admin/suppliers">
          <Building2 :size="18" /> 供应商管理
        </router-link>
        <router-link v-if="auth.isAdmin" class="nav-link" to="/admin/punishments">
          <ShieldAlert :size="18" /> 处罚记录
        </router-link>
        <router-link v-if="auth.isAdmin" class="nav-link" to="/admin/lottery-records">
          <ListChecks :size="18" /> 抽取记录
        </router-link>
        <router-link v-if="auth.user?.role === 'super_admin'" class="nav-link" to="/admin/users">
          <UsersRound :size="18" /> 用户管理
        </router-link>
      </nav>
    </aside>
    <main class="main-area">
      <header class="topbar">
        <div>
          <strong>{{ currentSection }}</strong>
          <span class="muted"> / {{ roleLabel }}</span>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
          <el-popover placement="bottom-end" width="360" trigger="click" @show="loadNotifications">
            <template #reference>
              <el-badge :value="unreadCount" :hidden="!unreadCount">
                <el-button :icon="Bell" circle />
              </el-badge>
            </template>
            <div class="toolbar" style="justify-content:space-between; margin-bottom:10px;">
              <strong>站内通知</strong>
              <el-button size="small" text @click="readAll">全部已读</el-button>
            </div>
            <el-empty v-if="notifications.length === 0" description="暂无通知" :image-size="64" />
            <div v-for="item in notifications" :key="item.id" style="padding:10px 0; border-top:1px solid var(--line);">
              <div style="display:flex; justify-content:space-between; gap:8px;">
                <strong>{{ item.title }}</strong>
                <el-tag v-if="!item.is_read" size="small" type="success">未读</el-tag>
              </div>
              <p class="muted" style="margin:6px 0 0;">{{ item.content }}</p>
            </div>
          </el-popover>
          <div class="topbar-account">
            <!-- <span>{{ auth.user?.display_name || auth.user?.username }}</span> -->
            <strong>{{ auth.user?.username }}</strong>
          </div>
          <el-button @click="logout">退出</el-button>
        </div>
      </header>
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Bell from 'lucide-vue-next/dist/esm/icons/bell.js'
import Building2 from 'lucide-vue-next/dist/esm/icons/building-2.js'
import ClipboardList from 'lucide-vue-next/dist/esm/icons/clipboard-list.js'
import FilePlus from 'lucide-vue-next/dist/esm/icons/file-plus.js'
import FolderClock from 'lucide-vue-next/dist/esm/icons/folder-clock.js'
import ListChecks from 'lucide-vue-next/dist/esm/icons/list-checks.js'
import ShieldAlert from 'lucide-vue-next/dist/esm/icons/shield-alert.js'
import UsersRound from 'lucide-vue-next/dist/esm/icons/users-round.js'
import { notificationsApi } from './api/notifications'
import { useAuthStore } from './stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const notifications = ref([])
const unreadCount = ref(0)

const isLoginPage = computed(() => route.path === '/login')
const roleLabel = computed(() => ({
  super_admin: '超级管理员',
  admin: '管理员',
  user: '课程责任单位'
}[auth.user?.role] || '未登录'))
const currentSection = computed(() => {
  if (route.path.includes('/suppliers')) return '供应商管理'
  if (route.path.includes('/punishments')) return '处罚记录'
  if (route.path.includes('/lottery-records')) return '抽取记录'
  if (route.path.includes('/users')) return '用户管理'
  if (route.path.includes('/user/submit')) return '提交项目'
  if (route.path.includes('/user/projects')) return '我的项目'
  if (route.path.includes('/admin/projects')) return '项目记录'
  return '工作台'
})

async function loadNotifications() {
  const data = await notificationsApi.list()
  notifications.value = data.items
  unreadCount.value = data.unread_count
}

async function readAll() {
  await notificationsApi.readAll()
  await loadNotifications()
}

function logout() {
  auth.logout()
  notifications.value = []
  unreadCount.value = 0
  router.push('/login')
}

watch(
  () => [auth.token, route.path],
  () => {
    if (auth.token && route.path !== '/login') {
      loadNotifications().catch(() => {})
    }
  },
  { immediate: true }
)
</script>
