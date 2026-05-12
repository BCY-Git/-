<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">供应商管理</h1>
        <p class="page-subtitle">维护中标排名、保密资质和联系人信息，抽取时按排名轮候。</p>
      </div>
      <el-button type="primary" @click="openCreate">新增供应商</el-button>
    </div>
    <div class="workspace">
      <el-table :data="items" stripe>
        <el-table-column prop="rank" label="排名" width="80" />
        <el-table-column prop="name" label="供应商名称" min-width="180" />
        <el-table-column label="资质" min-width="220">
          <template #default="{ row }">
            <el-tag v-if="row.qual_equipment" type="success">装备类涉密</el-tag>
            <el-tag v-if="row.qual_system" type="success" style="margin-left:6px;">信息系统集成类</el-tag>
            <span v-if="!row.qual_equipment && !row.qual_system" class="muted">公开项目</span>
          </template>
        </el-table-column>
        <el-table-column prop="contact_name" label="联系人" width="110" />
        <el-table-column prop="contact_phone" label="联系电话" width="140" />
        <el-table-column prop="active_project_count" label="未结题在研" width="120" />
        <el-table-column label="负荷状态" width="130">
          <template #default="{ row }">
            <el-tag :type="row.active_project_count > 5 ? 'warning' : 'success'">
              {{ row.active_project_count > 5 ? '本次可能暂停' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="处罚状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.is_punished ? 'danger' : 'info'">{{ row.is_punished ? '处罚期内' : '正常' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="230" align="center">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button text type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button text type="warning" @click="openPunish(row)">处罚</el-button>
              <el-button text type="danger" @click="remove(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="visible" :title="editing?.id ? '编辑供应商' : '新增供应商'" width="560px">
      <el-form :model="form" label-width="110px">
        <el-form-item label="供应商名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="中标排名"><el-input-number v-model="form.rank" :min="1" /></el-form-item>
        <el-form-item label="保密资质">
          <el-checkbox v-model="form.qual_equipment">装备类涉密</el-checkbox>
          <el-checkbox v-model="form.qual_system">信息系统集成类涉密</el-checkbox>
        </el-form-item>
        <el-form-item label="未结题在研">
          <el-input-number v-model="form.active_project_count" :min="0" :precision="0" />
        </el-form-item>
        <el-form-item label="联系人"><el-input v-model="form.contact_name" /></el-form-item>
        <el-form-item label="联系电话"><el-input v-model="form.contact_phone" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="form.email" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="punishVisible" title="处罚供应商" width="560px">
      <el-form :model="punishForm" label-width="100px">
        <el-form-item label="供应商">
          <el-input :model-value="punishTarget?.name" disabled />
        </el-form-item>
        <el-form-item label="处罚日期">
          <el-date-picker
            v-model="punishDateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始"
            end-placeholder="结束"
          />
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="punishForm.reason" type="textarea" :rows="3" placeholder="请输入处罚原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="punishVisible = false">取消</el-button>
        <el-button type="danger" @click="savePunishment">确认处罚</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api, deleteJson, postJson, putJson } from '../../api/client'

const items = ref([])
const visible = ref(false)
const editing = ref(null)
const form = reactive(blank())
const punishVisible = ref(false)
const punishTarget = ref(null)
const punishForm = reactive({ supplier_id: null, start_date: '', end_date: '', reason: '' })
const punishDateRange = computed({
  get: () => (punishForm.start_date && punishForm.end_date ? [punishForm.start_date, punishForm.end_date] : []),
  set: (value) => {
    punishForm.start_date = value?.[0] || ''
    punishForm.end_date = value?.[1] || ''
  }
})

function blank(rank = 1) {
  return { name: '', rank, qual_equipment: false, qual_system: false, active_project_count: 0, contact_name: '', contact_phone: '', email: '' }
}

function nextRank() {
  // 新增供应商默认使用下一个排名，避免误用已存在的 1 号排名。
  const ranks = items.value.map((item) => Number(item.rank)).filter(Number.isFinite)
  return ranks.length ? Math.max(...ranks) + 1 : 1
}

async function load() {
  // 供应商列表包含资质、负荷和处罚状态，是抽取候选池的维护入口。
  items.value = await api('/suppliers')
}

function openCreate() {
  // 新增时自动带出下一个可用排名，减少“中标排名已存在”的误操作。
  editing.value = null
  Object.assign(form, blank(nextRank()))
  visible.value = true
}

function openEdit(row) {
  // 编辑直接复用当前行数据，保存时后端会再次校验名称和排名唯一性。
  editing.value = row
  Object.assign(form, row)
  visible.value = true
}

function openPunish(row) {
  // 处罚默认一年期，管理员可按实际处罚决定调整日期。
  punishTarget.value = row
  Object.assign(punishForm, {
    supplier_id: row.id,
    start_date: formatDate(new Date()),
    end_date: formatDate(addYears(new Date(), 1)),
    reason: ''
  })
  punishVisible.value = true
}

async function save() {
  // 通过是否存在 id 区分新增和编辑，后端统一返回规范供应商结构。
  if (editing.value?.id) await putJson(`/suppliers/${editing.value.id}`, form)
  else await postJson('/suppliers', form)
  ElMessage.success('已保存')
  visible.value = false
  await load()
}

async function remove(row) {
  // 删除是软删除，历史抽取记录仍能保留供应商引用。
  await ElMessageBox.confirm(`确认删除 ${row.name}？`, '删除供应商')
  await deleteJson(`/suppliers/${row.id}`)
  ElMessage.success('已删除')
  await load()
}

async function savePunishment() {
  // 新增处罚后，该供应商会在处罚期内自动排除出抽取候选池。
  if (!punishForm.start_date || !punishForm.end_date) {
    ElMessage.warning('请选择处罚日期')
    return
  }
  await postJson('/punishments', punishForm)
  ElMessage.success('已处罚，已发送站内通知')
  punishVisible.value = false
  await load()
}

function addYears(date, years) {
  const next = new Date(date)
  next.setFullYear(next.getFullYear() + years)
  return next
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

onMounted(load)
</script>
