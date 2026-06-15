<template>
  <section class="login-page">
    <div class="login-panel">
      <h2 style="margin:0 0 8px;">统一认证登录中</h2>
      <p class="muted" style="margin:0;">正在写入登录态，请稍候。</p>
    </div>
  </section>
</template>

<script setup>
import { ElMessage } from 'element-plus'
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authApi } from '../api/auth'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

function readHashTicket() {
  const hash = window.location.hash.replace(/^#/, '')
  return new URLSearchParams(hash).get('ticket')
}

onMounted(async () => {
  const ticket = readHashTicket() || route.query.ticket
  if (!ticket || typeof ticket !== 'string') {
    ElMessage.error('统一认证登录失败')
    router.replace('/login')
    return
  }

  try {
    const data = await authApi.consumeSsoTicket(ticket)
    auth.setSession(data.access_token, data.user)
    router.replace(auth.isAdmin ? '/admin/projects' : '/user/submit')
  } catch {
    auth.logout()
    ElMessage.error('统一认证登录态校验失败')
    router.replace('/login')
  }
})
</script>
