<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">项目记录</h1>
        <p class="page-subtitle">查看所有课程建设需求和轮候抽取结果。</p>
      </div>
      <div style="display:flex; gap:10px;">
        <el-button type="primary" @click="openLottery">发起抽取</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
    </div>
    <div class="workspace">
      <div class="toolbar">
        <el-input v-model="filters.keyword" placeholder="项目名称" clearable style="width:220px;" />
        <el-select v-model="filters.secret_level" placeholder="涉密要求" clearable style="width:180px;">
          <el-option label="公开" value="公开" />
          <el-option label="装备类涉密" value="装备类涉密" />
          <el-option label="信息系统集成类涉密" value="信息系统集成类涉密" />
        </el-select>
        <el-select v-model="filters.status" placeholder="状态" clearable style="width:150px;">
          <el-option label="已完成" value="completed" />
          <el-option label="无供应商" value="no_supplier" />
        </el-select>
        <el-button @click="load">查询</el-button>
      </div>
      <el-table :data="pagedItems" stripe>
        <el-table-column prop="name" label="项目名称" min-width="180" />
        <el-table-column prop="creator_name" label="提交单位" width="140" />
        <el-table-column prop="secret_level" label="涉密要求" width="170" />
        <el-table-column prop="budget_wan" label="预算（万元）" width="120" />
        <el-table-column label="推荐供应商" min-width="180">
          <template #default="{ row }">
            <span v-if="row.latest_record?.winner_supplier_name">{{ row.latest_record.winner_supplier_name }}</span>
            <el-tag v-else type="warning">无符合条件</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="二次申请" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.latest_rerun_request" :type="rerunStatusType(row.latest_rerun_request.status)">
              {{ rerunStatusText(row.latest_rerun_request.status) }}
            </el-tag>
            <span v-else class="muted">未申请</span>
          </template>
        </el-table-column>
        <!-- <el-table-column prop="email_status" label="邮件状态" width="150" /> -->
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button text type="primary" @click="show(row)">通知书</el-button>
            <el-button
              v-if="row.latest_rerun_request?.attachments?.length"
              text
              type="warning"
              @click="openMaterials(row)"
            >
              验收材料
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="table-footer">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50]"
          :total="items.length"
          layout="total, sizes, prev, pager, next, jumper"
        />
      </div>
    </div>
    <el-dialog v-model="visible" title="供应商抽取结果通知书" width="860px" class="notice-dialog">
      <NoticeDetail :project="selected" />
    </el-dialog>

    <el-dialog v-model="lotteryFormVisible" title="发起供应商抽取" width="760px">
      <el-form ref="lotteryFormRef" :model="lotteryForm" :rules="rules" label-width="150px">
        <el-form-item label="项目名称" prop="name">
          <el-input v-model="lotteryForm.name" maxlength="256" />
        </el-form-item>
        <el-form-item label="项目概况" prop="overview">
          <el-input v-model="lotteryForm.overview" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="预算金额（万元）" prop="budget_wan">
          <el-input-number v-model="lotteryForm.budget_wan" :min="0.01" :precision="2" style="width:220px;" />
        </el-form-item>
        <el-form-item label="涉密要求" prop="secret_level">
          <el-radio-group v-model="lotteryForm.secret_level">
            <el-radio-button label="公开" />
            <el-radio-button label="装备类涉密" />
            <el-radio-button label="信息系统集成类涉密" />
          </el-radio-group>
        </el-form-item>
        <el-form-item label="项目负责人" prop="manager_name">
          <el-input v-model="lotteryForm.manager_name" />
        </el-form-item>
        <el-form-item label="联系方式" prop="contact">
          <el-input v-model="lotteryForm.contact" placeholder="联系电话或邮箱" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="lotteryFormVisible = false">取消</el-button>
        <el-button type="primary" :loading="lotteryLoading" @click="submitLottery">提交并抽取</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="processVisible" title="供应商轮候抽取" width="760px" :close-on-click-modal="processFinished || processFailed">
      <div class="lottery-process">
        <el-steps :active="activeStep" finish-status="success" :process-status="processFailed ? 'error' : 'process'" align-center>
          <el-step v-for="step in processSteps" :key="step.title" :title="step.title" :description="step.description" />
        </el-steps>
        <div class="lottery-visual" :class="{ done: processFinished, failed: processFailed }">
          <div class="lottery-ring">
            <span>A</span>
            <span>B</span>
            <span>C</span>
          </div>
          <div>
            <strong>{{ processTitle }}</strong>
            <p class="muted">{{ processDescription }}</p>
          </div>
        </div>
      </div>
      <div v-if="processFinished" class="result-notice">{{ resultNotice }}</div>
      <template #footer>
        <el-button type="primary" :disabled="!processFinished && !processFailed" @click="processVisible = false">确认</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="materialsVisible" title="项目验收材料" width="680px">
      <el-form label-width="100px">
        <el-form-item label="项目名称">
          <el-input :model-value="materialsProject?.name" disabled />
        </el-form-item>
        <el-form-item label="申请单位">
          <el-input :model-value="materialsRequest?.requester_name" disabled />
        </el-form-item>
        <el-form-item label="申请说明">
          <div class="result-notice">{{ materialsRequest?.reason || '未填写' }}</div>
        </el-form-item>
        <el-form-item label="验收材料">
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            <el-button
              v-for="file in materialsRequest?.attachments || []"
              :key="file.id"
              size="small"
              @click="downloadAttachment(file)"
            >
              {{ file.original_name }}
            </el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="materialsVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { projectsApi } from '../../api/projects'
import NoticeDetail from '../../components/NoticeDetail.vue'

const items = ref([])
const selected = ref(null)
const visible = ref(false)
const filters = reactive({ keyword: '', secret_level: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 10 })
const lotteryFormRef = ref()
const lotteryFormVisible = ref(false)
const lotteryLoading = ref(false)
const processVisible = ref(false)
const processFinished = ref(false)
const processFailed = ref(false)
const activeStep = ref(0)
const resultNotice = ref('')
const resultSummary = ref('')
const processError = ref('')
const materialsVisible = ref(false)
const materialsProject = ref(null)
const materialsRequest = ref(null)
const lotteryForm = reactive(blankLotteryForm())
const processSteps = [
  { title: '接收需求', description: '记录项目表单', running: '正在接收课程建设需求' },
  { title: '处罚校验', description: '排除处罚期供应商', running: '正在校验供应商处罚状态' },
  { title: '资质匹配', description: '匹配涉密要求', running: '正在匹配保密资质' },
  { title: '负荷校验', description: '均衡在研项目数量', running: '正在校验供应商在研项目负荷' },
  { title: '轮候定位', description: '读取全局指针', running: '正在定位下一家候选供应商' },
  { title: '结果通知', description: '生成通知书', running: '正在生成抽取结果通知书' }
]
const rules = {
  name: [{ required: true, message: '请填写项目名称', trigger: 'blur' }],
  budget_wan: [{ required: true, message: '请填写预算金额', trigger: 'change' }],
  secret_level: [{ required: true, message: '请选择涉密要求', trigger: 'change' }],
  manager_name: [{ required: true, message: '请填写项目负责人', trigger: 'blur' }],
  contact: [{ required: true, message: '请填写联系方式', trigger: 'blur' }]
}
const processTitle = computed(() => {
  if (processFailed.value) return '抽取失败'
  if (processFinished.value) return '抽取完成'
  return processSteps[activeStep.value]?.running || '正在抽取'
})
const processDescription = computed(() => {
  if (processFailed.value) return processError.value
  if (processFinished.value) return resultSummary.value
  return '系统正在按处罚状态、保密资质、在研项目负荷和全局轮候指针进行匹配。'
})
const pagedItems = computed(() => {
  const start = (pagination.page - 1) * pagination.pageSize
  return items.value.slice(start, start + pagination.pageSize)
})

async function load() {
  // 管理端项目列表按筛选条件读取全量项目，前端只负责当前页分页展示。
  items.value = await projectsApi.list(filters)
  pagination.page = 1
}

function show(row) {
  // 管理员查看通知书时使用同一份项目结果组件，确保和用户端展示一致。
  selected.value = row
  visible.value = true
}

function openLottery() {
  // 管理员可代为发起抽取，表单默认公开项目。
  Object.assign(lotteryForm, blankLotteryForm())
  lotteryFormVisible.value = true
}

function rerunStatusText(status) {
  // 二次抽取状态在页面统一映射成业务文案，兼容 uploaded 和旧审批状态。
  return {
    pending: '已上传材料',
    uploaded: '已上传材料',
    approved: '已上传材料',
    rejected: '未通过',
    used: '已完成'
  }[status] || '未知'
}

function rerunStatusType(status) {
  return {
    pending: 'warning',
    uploaded: 'success',
    approved: 'success',
    rejected: 'danger',
    used: 'info'
  }[status] || 'info'
}

function openMaterials(row) {
  // 管理端只读查看用户上传的验收材料和申请说明。
  materialsProject.value = row
  materialsRequest.value = row.latest_rerun_request
  materialsVisible.value = true
}

async function downloadAttachment(file) {
  // 材料下载走后端鉴权接口，避免直接暴露上传目录。
  await projectsApi.downloadRerunAttachment(materialsRequest.value.id, file.id, file.original_name)
}

async function submitLottery() {
  // 管理端发起抽取和用户端提交项目共用同一个后端接口。
  await lotteryFormRef.value.validate()
  lotteryFormVisible.value = false
  processVisible.value = true
  processFinished.value = false
  processFailed.value = false
  activeStep.value = 0
  resultNotice.value = ''
  resultSummary.value = ''
  processError.value = ''
  lotteryLoading.value = true
  try {
    const data = await runLotteryProgress(() => projectsApi.create(lotteryForm))
    resultNotice.value = data.result_notice
    resultSummary.value = data.latest_record?.winner_supplier_name
      ? `中选供应商：${data.latest_record.winner_supplier_name}`
      : '当前无符合条件的供应商'
    processFinished.value = true
    ElMessage.success(data.status === 'completed' ? '抽取完成' : '当前无符合条件供应商')
    await load()
  } catch (error) {
    processFailed.value = true
    processError.value = error?.message || '抽取请求失败，请关闭后重试。'
  } finally {
    lotteryLoading.value = false
  }
}

async function runLotteryProgress(request) {
  // 用前端步骤动画表达后端抽取规则，真实结果以接口返回为准。
  const requestPromise = withTimeout(request(), 15000)
  for (let index = 0; index < processSteps.length - 1; index += 1) {
    activeStep.value = index
    await sleep(420)
  }
  const data = await requestPromise
  activeStep.value = processSteps.length
  await sleep(260)
  return data
}

function withTimeout(promise, ms) {
  // 接口超时后给出明确错误，避免现场以为系统卡死。
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('抽取请求超时，请确认服务是否正常后重试。')), ms)
    })
  ])
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function blankLotteryForm() {
  return {
    name: '',
    overview: '',
    budget_wan: 1,
    secret_level: '公开',
    manager_name: '',
    contact: ''
  }
}

onMounted(load)
</script>
