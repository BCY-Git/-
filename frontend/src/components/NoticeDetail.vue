<template>
  <div v-if="project" class="notice-detail">
    <header class="notice-hero">
      <div>
        <span class="notice-kicker">供应商抽取结果通知书</span>
        <h2>{{ project.name }}</h2>
        <p>{{ project.overview || '暂无项目概况' }}</p>
      </div>
      <div class="notice-result">
        <span>推荐供应商</span>
        <strong>{{ supplierName }}</strong>
      </div>
    </header>

    <section class="notice-section">
      <div class="notice-section-title">
        <strong>项目基本信息</strong>
        <span>课程建设需求确认书</span>
      </div>
      <dl class="notice-grid">
        <div>
          <dt>预算金额</dt>
          <dd>{{ budgetText }}</dd>
        </div>
        <div>
          <dt>涉密要求</dt>
          <dd>{{ project.secret_level }}</dd>
        </div>
        <div>
          <dt>项目负责人</dt>
          <dd>{{ project.manager_name }}</dd>
        </div>
        <div>
          <dt>联系方式</dt>
          <dd>{{ project.contact }}</dd>
        </div>
        <div>
          <dt>提交单位</dt>
          <dd>{{ project.creator_name || '未记录' }}</dd>
        </div>
        <div>
          <dt>提交时间</dt>
          <dd>{{ formatDateTime(project.created_at) }}</dd>
        </div>
      </dl>
    </section>

    <section class="notice-section">
      <div class="notice-section-title">
        <strong>抽取记录</strong>
        <span>{{ project.lottery_count || records.length }} 次抽取</span>
      </div>
      <div class="notice-timeline">
        <div v-for="record in records" :key="record.id" class="notice-timeline-item">
          <div class="notice-dot" />
          <div>
            <strong>{{ roundLabel(record.round_no) }}</strong>
            <p>{{ record.winner_supplier_name || '无符合条件的供应商' }}</p>
          </div>
          <time>{{ formatDateTime(record.lottery_time) }}</time>
        </div>
      </div>
    </section>

    <section class="notice-section">
      <div class="notice-section-title">
        <strong>通知书正文</strong>
        <span>系统生成</span>
      </div>
      <pre class="notice-paper">{{ sanitizedNotice }}</pre>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  project: {
    type: Object,
    default: null
  }
})

const records = computed(() => props.project?.lottery_records || (props.project?.latest_record ? [props.project.latest_record] : []))
const supplierName = computed(() => props.project?.latest_record?.winner_supplier_name || '无符合条件')
const budgetText = computed(() => {
  const value = Number(props.project?.budget_wan || 0)
  return Number.isFinite(value) ? `${value.toFixed(2)} 万元` : '未记录'
})
const sanitizedNotice = computed(() => {
  const notice = props.project?.result_notice || ''
  return notice
    .split('\n')
    .filter((line) => !line.includes('抽取前指针') && !line.includes('抽取后指针') && !line.includes('中标排名'))
    .join('\n')
})

function roundLabel(roundNo) {
  if (!roundNo || roundNo === 1) return '首次抽取'
  if (roundNo === 2) return '二次抽取'
  return `第 ${roundNo} 次抽取`
}

function formatDateTime(value) {
  if (!value) return '未记录'
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>
