export function toUserRead(user: any) {
  const { passwordHash, ...rest } = user
  return {
    id: rest.id,
    username: rest.username,
    role: rest.role,
    display_name: rest.displayName,
    email: rest.email,
    is_active: rest.isActive,
    created_at: rest.createdAt
  }
}

export function toSupplierRead(supplier: any, isPunished = false) {
  return {
    id: supplier.id,
    name: supplier.name,
    rank: supplier.rank,
    qual_equipment: supplier.qualEquipment,
    qual_system: supplier.qualSystem,
    active_project_count: supplier.activeProjectCount,
    load_status: supplier.activeProjectCount > 5 ? '本次可能暂停' : '正常',
    contact_name: supplier.contactName,
    contact_phone: supplier.contactPhone,
    email: supplier.email,
    is_deleted: supplier.isDeleted,
    is_punished: isPunished,
    created_at: supplier.createdAt
  }
}

export function toPunishmentRead(punishment: any, status: string) {
  return {
    id: punishment.id,
    supplier_id: punishment.supplierId,
    supplier_name: punishment.supplier?.name || null,
    start_date: dateOnly(punishment.startDate),
    end_date: dateOnly(punishment.endDate),
    reason: punishment.reason,
    status,
    created_by: punishment.createdBy,
    created_at: punishment.createdAt
  }
}

export function toLotteryRecordRead(record: any) {
  return {
    id: record.id,
    project_id: record.projectId,
    project_name: record.project?.name || null,
    winner_supplier_id: record.winnerSupplierId,
    winner_supplier_name: record.winnerSupplier?.name || null,
    winner_rank: record.winnerRank,
    pointer_before: record.pointerBefore,
    pointer_after: record.pointerAfter,
    round_no: record.roundNo,
    lottery_time: record.lotteryTime
  }
}

export function toProjectRead(project: any) {
  const sortedRecords = [...(project.lotteryRecords || [])].sort(
    (a, b) => new Date(b.lotteryTime).getTime() - new Date(a.lotteryTime).getTime()
  )
  const sortedRequests = [...(project.rerunRequests || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  return {
    id: project.id,
    name: project.name,
    overview: project.overview,
    budget_wan: project.budgetWan,
    secret_level: project.secretLevel,
    manager_name: project.managerName,
    contact: project.contact,
    created_by: project.createdBy,
    creator_name: project.creator?.displayName || project.creator?.username || null,
    status: project.status,
    result_notice: project.resultNotice,
    email_status: project.emailStatus,
    created_at: project.createdAt,
    latest_record: sortedRecords[0] ? toLotteryRecordRead(sortedRecords[0]) : null,
    lottery_records: sortedRecords.map(toLotteryRecordRead),
    lottery_count: sortedRecords.length,
    latest_rerun_request: sortedRequests[0] ? toRerunRequestRead(sortedRequests[0]) : null
  }
}

export function toRerunRequestRead(item: any) {
  return {
    id: item.id,
    project_id: item.projectId,
    project_name: item.project?.name || null,
    requester_id: item.requesterId,
    requester_name: item.requester?.displayName || item.requester?.username || null,
    status: item.status,
    reason: item.reason,
    review_comment: item.reviewComment,
    reviewer_id: item.reviewerId,
    reviewer_name: item.reviewer?.displayName || item.reviewer?.username || null,
    reviewed_at: item.reviewedAt,
    used_at: item.usedAt,
    created_at: item.createdAt,
    attachments: (item.attachments || []).map((file: any) => ({
      id: file.id,
      original_name: file.originalName,
      mime_type: file.mimeType,
      size: file.size,
      created_at: file.createdAt
    }))
  }
}

export function toNotificationRead(item: any) {
  return {
    id: item.id,
    title: item.title,
    content: item.content,
    is_read: item.isRead,
    project_id: item.projectId,
    created_at: item.createdAt
  }
}

export function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10)
}

export function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}
