<template>
  <section class="login-page">
    <div class="login-hero">
      <h1>供应商轮候抽取系统</h1>
      <p>面向课程建设项目的内网申报、供应商校验、排名轮候抽取和结果追溯平台。</p>
    </div>
    <div class="login-panel">
      <el-form class="login-form" :model="form" label-position="top" @submit.prevent="submit">
        <h2 style="margin:0 0 8px;">登录系统</h2>
        <p class="muted" style="margin:0 0 24px;">请输入账号和密码进入工作台。</p>
        <el-form-item label="账号">
          <el-input v-model="form.username" size="large" autocomplete="username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" size="large" type="password" autocomplete="current-password" show-password />
        </el-form-item>
        <el-button type="primary" size="large" style="width:100%; margin-top:8px;" :loading="loading" @click="submit">
          登录
        </el-button>
        <el-button v-if="ssoEnabled" size="large" style="width:100%; margin:12px 0 0;" @click="loginWithSso">
          统一认证登录
        </el-button>
      </el-form>
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, API_BASE } from '../api/client'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const ssoEnabled = ref(false)
const form = reactive({ username: '', password: '' })

onMounted(async () => {
  try {
    const status = await api('/auth/sso/status')
    ssoEnabled.value = Boolean(status?.enabled)
  } catch {
    ssoEnabled.value = false
  }
})

async function submit() {
  loading.value = true
  try {
    await auth.login({ ...form, username: form.username.trim() })
    router.push(auth.isAdmin ? '/admin/projects' : '/user/submit')
  } finally {
    loading.value = false
  }
}

function loginWithSso() {
  const returnUrl = encodeURIComponent('/')
  window.location.href = `${API_BASE}/auth/sso/start?return_url=${returnUrl}`
}
</script>
