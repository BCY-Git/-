<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">处罚记录</h1>
        <p class="page-subtitle">处罚期内供应商会在所有抽取中自动排除，状态按日期实时计算。</p>
      </div>
      <el-button type="primary" @click="openCreate">新增处罚</el-button>
    </div>
    <div class="workspace">
      <el-table :data="items" stripe>
        <el-table-column prop="supplier_name" label="供应商" min-width="160" />
        <el-table-column prop="start_date" label="开始日期" width="130" />
        <el-table-column prop="end_date" label="结束日期" width="130" />
        <el-table-column prop="reason" label="原因" min-width="220" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'danger' : 'info'">{{ row.status === 'active' ? '进行中' : '已结束' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button text type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button v-if="auth.isSuperAdmin && row.status === 'active'" text type="warning" @click="lift(row)">解除</el-button>
              <el-button text type="danger" @click="remove(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="visible" :title="editing?.id ? '编辑处罚' : '新增处罚'" width="560px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="供应商">
          <el-select v-model="form.supplier_id" style="width:100%;">
            <el-option v-for="supplier in suppliers" :key="supplier.id" :label="supplier.name" :value="supplier.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="处罚日期">
          <el-date-picker v-model="dateRange" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始" end-placeholder="结束" />
        </el-form-item>
        <el-form-item label="原因"><el-input v-model="form.reason" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { punishmentsApi } from '../../api/punishments'
import { suppliersApi } from '../../api/suppliers'
import { useAuthStore } from '../../stores/auth'

const items = ref([])
const suppliers = ref([])
const visible = ref(false)
const editing = ref(null)
const auth = useAuthStore()
const form = reactive({ supplier_id: null, start_date: '', end_date: '', reason: '' })
const dateRange = computed({
  get: () => (form.start_date && form.end_date ? [form.start_date, form.end_date] : []),
  set: (value) => {
    form.start_date = value?.[0] || ''
    form.end_date = value?.[1] || ''
  }
})

async function load() {
  ;[items.value, suppliers.value] = await Promise.all([punishmentsApi.list(), suppliersApi.list()])
}

function openCreate() {
  editing.value = null
  Object.assign(form, { supplier_id: suppliers.value[0]?.id, start_date: '', end_date: '', reason: '' })
  visible.value = true
}

function openEdit(row) {
  editing.value = row
  Object.assign(form, row)
  visible.value = true
}

async function save() {
  if (editing.value?.id) {
    await punishmentsApi.update(editing.value.id, form)
    ElMessage.success('已保存')
  } else {
    await punishmentsApi.create(form)
    ElMessage.success('已保存，已发送站内通知')
  }
  visible.value = false
  await load()
}

async function remove(row) {
  await ElMessageBox.confirm('确认删除该处罚记录？', '删除处罚')
  await punishmentsApi.remove(row.id)
  ElMessage.success('已删除')
  await load()
}

async function lift(row) {
  await ElMessageBox.confirm(`确认解除“${row.supplier_name}”当前处罚？解除后该供应商可参与后续抽取。`, '解除处罚')
  await punishmentsApi.lift(row.id)
  ElMessage.success('已解除处罚，已发送站内通知')
  await load()
}

onMounted(load)
</script>

<style scoped>
.table-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.table-actions :deep(.el-button) {
  margin-left: 0;
}
</style>
