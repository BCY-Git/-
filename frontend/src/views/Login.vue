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
      </el-form>
    </div>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const form = reactive({ username: '', password: '' })

async function submit() {
  loading.value = true
  try {
    await auth.login({ ...form, username: form.username.trim() })
    router.push(auth.isAdmin ? '/admin/projects' : '/user/submit')
  } finally {
    loading.value = false
  }
}
</script>
