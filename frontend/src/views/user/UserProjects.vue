<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">我的项目</h1>
        <p class="page-subtitle">查看本人提交的项目和抽取结果通知书。</p>
      </div>
      <el-button type="primary" @click="load">刷新</el-button>
    </div>
    <div class="workspace">
      <el-table :data="items" stripe>
        <el-table-column prop="name" label="项目名称" min-width="180" />
        <el-table-column prop="secret_level" label="涉密要求" width="170" />
        <el-table-column prop="budget_wan" label="预算（万元）" width="120" />
        <el-table-column label="抽取结果" min-width="180">
          <template #default="{ row }">
            <span v-if="row.latest_record?.winner_supplier_name">{{ row.latest_record.winner_supplier_name }}</span>
            <el-tag v-else type="warning">无符合条件供应商</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="提交时间" width="190" />
        <el-table-column label="二次抽取" width="130">
          <template #default="{ row }">
            <el-tag v-if="['uploaded', 'approved'].includes(row.latest_rerun_request?.status)" type="success">已上传材料</el-tag>
            <el-tag v-else-if="row.latest_rerun_request?.status === 'pending'" type="warning">已上传材料</el-tag>
            <el-tag v-else-if="row.latest_rerun_request?.status === 'rejected'" type="danger">未通过</el-tag>
            <el-tag v-else-if="row.latest_rerun_request?.status === 'used'" type="info">已完成</el-tag>
            <span v-else class="muted">未申请</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260">
          <template #default="{ row }">
            <el-button text type="primary" @click="show(row)">通知书</el-button>
            <el-button v-if="canSubmitRerunRequest(row)" text type="warning" @click="openRerunRequest(row)">申请二次抽取</el-button>
            <el-button
              v-if="['uploaded', 'approved'].includes(row.latest_rerun_request?.status)"
              text
              type="success"
              :loading="rerunLoadingId === row.id"
              @click="rerun(row)"
            >
              二次抽取
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <el-dialog v-model="visible" title="供应商抽取结果通知书" width="860px" class="notice-dialog">
      <NoticeDetail :project="selected" />
    </el-dialog>

    <el-dialog v-model="requestVisible" title="项目验收材料上传" width="660px">
      <el-form label-width="100px">
        <el-form-item label="项目名称">
          <el-input :model-value="requestProject?.name" disabled />
        </el-form-item>
        <div class="rerun-rule-box">
          <AlertTriangle class="rule-icon" :size="18" />
          <div>
            <strong>二次抽取说明</strong>
            <p>适用于项目组认定供应商无法完成，或中标供应商拒绝承接项目。二次抽取应在签订合同前完成，项目组对上传材料真实性、完整性自行负责。</p>
          </div>
        </div>
        <el-form-item label="申请说明">
          <el-input v-model="requestReason" type="textarea" :rows="3" placeholder="说明供应商无法满足需求或拒绝承接的情况" />
        </el-form-item>
        <el-form-item label="项目验收材料">
          <div
            class="file-drop"
            role="button"
            tabindex="0"
            @click="triggerFileSelect"
            @keydown.enter.prevent="triggerFileSelect"
            @keydown.space.prevent="triggerFileSelect"
            @dragover.prevent
            @drop.prevent="handleFiles($event.dataTransfer.files)"
          >
            <input ref="fileInput" class="file-input" type="file" accept=".pdf,application/pdf" multiple @change="onFileSelected" />
            <div class="file-drop-title">拖拽或点击上传 PDF 项目验收材料</div>
            <el-button type="primary" plain size="small" @click.stop="triggerFileSelect">选择 PDF 文件</el-button>
          </div>
          <div class="muted upload-tip">仅支持 PDF，最多 5 个文件，单个文件不超过 20MB。</div>
          <div v-if="fileList.length" class="selected-files">
            <div v-for="(file, index) in fileList" :key="`${file.name}-${index}`" class="selected-file">
              <span>{{ file.name }}</span>
              <el-button text type="danger" size="small" @click="removeFile(index)">删除</el-button>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="requestVisible = false">取消</el-button>
        <el-button type="primary" :loading="requestLoading" @click="submitRerunRequest">上传项目验收材料</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AlertTriangle from 'lucide-vue-next/dist/esm/icons/triangle-alert.js'
import { api, postJson, uploadForm } from '../../api/client'
import NoticeDetail from '../../components/NoticeDetail.vue'

const items = ref([])
const selected = ref(null)
const visible = ref(false)
const requestVisible = ref(false)
const requestProject = ref(null)
const requestReason = ref('')
const fileList = ref([])
const fileInput = ref(null)
const requestLoading = ref(false)
const rerunLoadingId = ref(null)

async function load() {
  // 我的项目只读取当前登录用户提交的项目。
  items.value = await api('/projects/mine')
}

function show(row) {
  // 通知书基于项目最新抽取记录展示，包含首次和二次抽取结果。
  selected.value = row
  visible.value = true
}

function canSubmitRerunRequest(row) {
  // 只有首次抽到供应商，且没有可用材料时，才允许重新上传验收材料。
  if (!row.latest_record?.winner_supplier_name) return false
  return !row.latest_rerun_request || ['rejected', 'used'].includes(row.latest_rerun_request.status)
}

function openRerunRequest(row) {
  // 每次打开上传弹窗都清空旧文件，避免误提交上一次选择的材料。
  requestProject.value = row
  requestReason.value = ''
  fileList.value = []
  if (fileInput.value) fileInput.value.value = ''
  requestVisible.value = true
}

function triggerFileSelect() {
  fileInput.value?.click()
}

function onFileSelected(event) {
  handleFiles(event.target.files)
  event.target.value = ''
}

function handleFiles(files) {
  // 前端先拦截文件格式、大小和数量，后端仍会做最终校验。
  const incoming = Array.from(files || [])
  if (!incoming.length) return
  const invalid = incoming.find((file) => !file.name.toLowerCase().endsWith('.pdf'))
  if (invalid) {
    ElMessage.warning('仅支持上传 PDF 格式的项目验收材料')
    return
  }
  const oversized = incoming.find((file) => file.size > 20 * 1024 * 1024)
  if (oversized) {
    ElMessage.warning('单个文件不能超过 20MB')
    return
  }
  if (fileList.value.length + incoming.length > 5) {
    ElMessage.warning('最多上传 5 个文件')
    return
  }
  fileList.value.push(...incoming.map((file) => ({ name: file.name, raw: file, size: file.size })))
}

function removeFile(index) {
  fileList.value.splice(index, 1)
}

async function submitRerunRequest() {
  // 上传验收材料成功后，项目进入可二次抽取状态。
  if (!fileList.value.length) {
    ElMessage.warning('请上传项目验收材料')
    return
  }
  const invalid = fileList.value.some((file) => !file.name.toLowerCase().endsWith('.pdf'))
  if (invalid) {
    ElMessage.warning('仅支持上传 PDF 格式的项目验收材料')
    return
  }
  const body = new FormData()
  body.append('reason', requestReason.value)
  fileList.value.forEach((file) => body.append('files', file.raw))

  requestLoading.value = true
  try {
    await uploadForm(`/projects/${requestProject.value.id}/rerun-requests`, body)
    ElMessage.success('项目验收材料已上传，可发起二次抽取')
    requestVisible.value = false
    await load()
  } finally {
    requestLoading.value = false
  }
}

async function rerun(row) {
  // 二次抽取会排除该项目历史中选供应商，并生成新一轮抽取记录。
  await ElMessageBox.confirm(`确认对“${row.name}”发起二次抽取？`, '二次抽取')
  rerunLoadingId.value = row.id
  try {
    const data = await postJson(`/projects/${row.id}/rerun`, {})
    selected.value = data
    visible.value = true
    ElMessage.success(data.latest_record?.winner_supplier_name ? '二次抽取完成' : '当前无符合条件供应商')
    await load()
  } finally {
    rerunLoadingId.value = null
  }
}

onMounted(load)
</script>

<style scoped>
.rerun-rule-box {
  display: flex;
  gap: 10px;
  margin: 0 0 18px 100px;
  padding: 12px 14px;
  border: 1px solid #f3d19e;
  border-radius: 6px;
  background: #fdf6ec;
  color: #7d5b25;
  line-height: 1.6;
}

.rerun-rule-box p {
  margin: 4px 0 0;
}

.rule-icon {
  flex: 0 0 auto;
  margin-top: 3px;
  color: #e6a23c;
}

.file-drop {
  width: 100%;
  min-height: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 1px dashed #409eff;
  border-radius: 8px;
  background: #fff;
  color: #409eff;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.file-drop:hover,
.file-drop:focus {
  border-color: #337ecc;
  background: #ecf5ff;
  outline: none;
}

.file-input {
  display: none;
}

.file-drop-title {
  font-size: 16px;
  font-weight: 600;
}

.upload-tip {
  margin-top: 8px;
}

.selected-files {
  width: 100%;
  margin-top: 10px;
  display: grid;
  gap: 6px;
}

.selected-file {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f9fafb;
}
</style>
