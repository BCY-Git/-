<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">用户管理</h1>
        <p class="page-subtitle">超级管理员创建课程责任单位账号，并可设置多个管理员。</p>
      </div>
      <el-button type="primary" @click="openCreate">新增用户</el-button>
    </div>
    <div class="workspace">
      <el-table :data="items" stripe>
        <el-table-column prop="username" label="账号" width="150" />
        <el-table-column prop="display_name" label="显示名称" min-width="160" />
        <el-table-column prop="email" label="邮箱" min-width="180" />
        <el-table-column label="角色" width="150">
          <template #default="{ row }">
            <el-tag v-if="row.role === 'super_admin'" type="danger">超级管理员</el-tag>
            <el-select v-else v-model="row.role" size="small" @change="updateRole(row)">
              <el-option label="管理员" value="admin" />
              <el-option label="普通用户" value="user" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-switch v-model="row.is_active" :disabled="row.role === 'super_admin'" @change="updateActive(row)" />
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="visible" title="新增用户" width="520px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="账号"><el-input v-model="form.username" /></el-form-item>
        <el-form-item label="初始密码"><el-input v-model="form.password" type="password" show-password /></el-form-item>
        <el-form-item label="显示名称"><el-input v-model="form.display_name" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="form.email" /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width:100%;">
            <el-option label="管理员" value="admin" />
            <el-option label="普通用户" value="user" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="save">创建</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { api, patchJson, postJson, putJson } from '../../api/client'

const items = ref([])
const visible = ref(false)
const form = reactive({ username: '', password: '', display_name: '', email: '', role: 'user', is_active: true })

async function load() {
  items.value = await api('/users')
}

function openCreate() {
  Object.assign(form, { username: '', password: '', display_name: '', email: '', role: 'user', is_active: true })
  visible.value = true
}

async function save() {
  await postJson('/users', { ...form, username: form.username.trim() })
  ElMessage.success('用户已创建')
  visible.value = false
  await load()
}

async function updateRole(row) {
  await putJson(`/users/${row.id}/role`, { role: row.role })
  ElMessage.success('角色已更新')
}

async function updateActive(row) {
  await patchJson(`/users/${row.id}/active`, { is_active: row.is_active })
  ElMessage.success('状态已更新')
}

onMounted(load)
</script>
