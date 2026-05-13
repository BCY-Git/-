<template>
  <section class="login-page">
    <div class="login-hero">
      <h1>供应商轮候抽取系统</h1>
      <p>正在完成统一认证登录。</p>
    </div>
    <div class="login-panel">
      <div class="login-form">
        <h2 style="margin:0 0 8px;">统一认证</h2>
        <p class="muted" style="margin:0;">{{ message }}</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const message = ref('正在校验登录状态...')

onMounted(() => {
  try {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const token = params.get('token')
    const userText = params.get('user')
    const returnUrl = params.get('return_url') || '/'
    if (!token || !userText) throw new Error('统一认证返回信息不完整')
    const user = JSON.parse(userText)
    auth.setSession(token, user)
    router.replace(returnUrl)
  } catch (error) {
    message.value = error.message || '统一认证登录失败'
    ElMessage.error(message.value)
    router.replace('/login')
  }
})
</script>
