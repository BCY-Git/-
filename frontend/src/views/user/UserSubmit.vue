<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">提交项目</h1>
        <p class="page-subtitle">填写《课程建设需求确认书》，提交后系统立即执行校验和轮候抽取。</p>
      </div>
    </div>
    <div class="workspace">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="150px">
        <el-form-item label="项目名称" prop="name">
          <el-input v-model="form.name" maxlength="256" />
        </el-form-item>
        <el-form-item label="项目概况" prop="overview">
          <el-input v-model="form.overview" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="预算金额（万元）" prop="budget_wan">
          <el-input-number v-model="form.budget_wan" :min="0.01" :precision="2" style="width:220px;" />
        </el-form-item>
        <el-form-item label="涉密要求" prop="secret_level">
          <el-radio-group v-model="form.secret_level">
            <el-radio-button label="公开" />
            <el-radio-button label="装备类涉密" />
            <el-radio-button label="信息系统集成类涉密" />
          </el-radio-group>
        </el-form-item>
        <el-form-item label="项目负责人" prop="manager_name">
          <el-input v-model="form.manager_name" />
        </el-form-item>
        <el-form-item label="联系方式" prop="contact">
          <el-input v-model="form.contact" placeholder="联系电话或邮箱" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="submit">提交并抽取</el-button>
          <el-button @click="reset">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

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
  </section>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { postJson } from '../../api/client'

const formRef = ref()
const loading = ref(false)
const processVisible = ref(false)
const processFinished = ref(false)
const processFailed = ref(false)
const activeStep = ref(0)
const resultNotice = ref('')
const resultSummary = ref('')
const processError = ref('')
const processSteps = [
  { title: '接收需求', description: '记录项目表单', running: '正在接收课程建设需求' },
  { title: '处罚校验', description: '排除处罚期供应商', running: '正在校验供应商处罚状态' },
  { title: '资质匹配', description: '匹配涉密要求', running: '正在匹配保密资质' },
  { title: '负荷校验', description: '均衡在研项目数量', running: '正在校验供应商在研项目负荷' },
  { title: '轮候定位', description: '读取全局指针', running: '正在定位下一家候选供应商' },
  { title: '结果通知', description: '生成通知书', running: '正在生成抽取结果通知书' }
]
const form = reactive({
  name: '',
  overview: '',
  budget_wan: 1,
  secret_level: '公开',
  manager_name: '',
  contact: ''
})

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

async function submit() {
  // 提交项目时直接调用后端抽取接口，抽取结果随项目一起返回。
  await formRef.value.validate()
  loading.value = true
  processVisible.value = true
  processFinished.value = false
  processFailed.value = false
  activeStep.value = 0
  resultNotice.value = ''
  resultSummary.value = ''
  processError.value = ''
  try {
    const data = await runLotteryProgress(() => postJson('/projects', form))
    resultNotice.value = data.result_notice
    resultSummary.value = data.latest_record?.winner_supplier_name
      ? `中选供应商：${data.latest_record.winner_supplier_name}`
      : '当前无符合条件的供应商'
    processFinished.value = true
    ElMessage.success(data.status === 'completed' ? '项目已提交并完成抽取' : '项目已提交，当前无符合条件供应商')
    reset()
  } catch (error) {
    processFailed.value = true
    processError.value = error?.message || '抽取请求失败，请关闭后重试。'
  } finally {
    loading.value = false
  }
}

function reset() {
  // 提交成功后恢复默认公开项目表单，便于连续录入。
  Object.assign(form, {
    name: '',
    overview: '',
    budget_wan: 1,
    secret_level: '公开',
    manager_name: '',
    contact: ''
  })
}

async function runLotteryProgress(request) {
  // 后端抽取很快完成，前端用步骤动画把处罚、资质、负荷和轮候过程展示出来。
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
  // 防止接口异常悬挂导致抽取弹窗一直停在处理中。
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
</script>
