<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">抽取记录</h1>
        <p class="page-subtitle">全局轮候指针跨所有项目类型共用，历史结果保留排名快照。</p>
      </div>
      <el-button type="primary" @click="load">刷新</el-button>
    </div>
    <div class="workspace">
      <el-table :data="items" stripe>
        <el-table-column prop="project_name" label="项目名称" min-width="200" />
        <el-table-column label="中选供应商" min-width="160">
          <template #default="{ row }">
            <span v-if="row.winner_supplier_name">{{ row.winner_supplier_name }}</span>
            <el-tag v-else type="warning">无符合条件</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="pointer_before" label="抽取前指针" width="120" />
        <el-table-column prop="pointer_after" label="抽取后指针" width="120" />
        <el-table-column prop="lottery_time" label="抽取时间" width="190" />
      </el-table>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { projectsApi } from '../../api/projects'

const items = ref([])
async function load() {
  items.value = await projectsApi.lotteryRecords()
}
onMounted(load)
</script>
