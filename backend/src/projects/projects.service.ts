import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { open, unlink } from 'fs/promises'
import { toLotteryRecordRead, toProjectRead, toRerunRequestRead } from '../common/formatters'
import { PrismaService } from '../prisma/prisma.service'
import { CreateProjectDto, ReviewRerunRequestDto } from './projects.dto'

const POINTER_KEY = 'global_pointer'
const PDF_HEADER = '%PDF'

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: any, dto: CreateProjectDto) {
    // 普通用户和管理员都能提交项目；提交后立即进入轮候抽取。
    if (!['user', 'admin', 'super_admin'].includes(user.role)) throw new ForbiddenException('当前角色不可提交项目')

    const project = await this.prisma.$transaction(async (tx) => {
      // 先落项目主表，抽取记录需要引用项目 id。
      const created = await tx.project.create({
        data: {
          name: dto.name,
          overview: dto.overview,
          budgetWan: dto.budget_wan,
          secretLevel: dto.secret_level,
          managerName: dto.manager_name,
          contact: dto.contact,
          createdBy: user.id,
          status: 'pending'
        }
      })

      // 在同一事务内完成抽取、通知书生成和项目状态更新，保证结果一致。
      const { record, winner } = await this.runLottery(tx, created)
      const resultNotice = this.buildResultNotice(created, winner, record)
      const emailStatus = this.sendResultEmails(dto.contact, winner, resultNotice)

      // 抽取结果写入站内通知，普通用户可在通知中心看到结果。
      await tx.notification.create({
        data: {
          userId: user.id,
          title: '供应商抽取结果',
          content: winner
            ? `项目“${created.name}”已完成轮候抽取，中选供应商为 ${winner.name}。`
            : `项目“${created.name}”已完成校验，当前无符合条件的供应商。`,
          projectId: created.id
        }
      })

      return tx.project.update({
        where: { id: created.id },
        data: {
          status: winner ? 'completed' : 'no_supplier',
          resultNotice,
          emailStatus
        },
        include: this.projectInclude()
      })
    })

    return toProjectRead(project)
  }

  async list(filters: { keyword?: string; secret_level?: string; status?: string }) {
    // 管理端项目列表支持按名称、涉密等级和状态组合筛选。
    const projects = await this.prisma.project.findMany({
      where: {
        ...(filters.keyword ? { name: { contains: filters.keyword } } : {}),
        ...(filters.secret_level ? { secretLevel: filters.secret_level } : {}),
        ...(filters.status ? { status: filters.status } : {})
      },
      include: this.projectInclude(),
      orderBy: { createdAt: 'desc' }
    })
    return projects.map(toProjectRead)
  }

  async mine(user: any) {
    // 普通用户只看自己提交的项目，避免跨单位查看项目结果。
    const projects = await this.prisma.project.findMany({
      where: { createdBy: user.id },
      include: this.projectInclude(),
      orderBy: { createdAt: 'desc' }
    })
    return projects.map(toProjectRead)
  }

  async get(user: any, id: number) {
    // 单项目详情同样执行普通用户归属校验，管理员不受此限制。
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: this.projectInclude()
    })
    if (!project) throw new NotFoundException('项目不存在')
    if (user.role === 'user' && project.createdBy !== user.id) throw new ForbiddenException('无权查看该项目')
    return toProjectRead(project)
  }

  async submitRerunRequest(user: any, projectId: number, files: any[], reason?: string) {
    // 二次抽取材料只能由项目所属普通用户上传。
    if (user.role !== 'user') throw new ForbiddenException('仅课程责任单位可提交二次抽取申请')
    if (!files?.length) throw new BadRequestException('请上传项目验收材料')
    // 甲方当前要求验收材料为 PDF，文件类型在 controller 和 service 双重校验。
    if (files.some((file) => !file.originalname?.toLowerCase().endsWith('.pdf'))) {
      throw new BadRequestException('仅支持上传 PDF 格式的项目验收材料')
    }
    await this.validatePdfFiles(files)

    const request = await this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: projectId },
        include: { lotteryRecords: true }
      })
      if (!project) throw new NotFoundException('项目不存在')
      if (project.createdBy !== user.id) throw new ForbiddenException('无权操作该项目')
      // 首次抽取完成后才允许上传验收材料申请二次抽取。
      if (!project.lotteryRecords.length) throw new BadRequestException('项目尚未完成抽取，不能申请二次抽取')

      // 同一个项目同一用户只能保留一份可用材料，避免重复二次抽取入口混乱。
      const activeRequest = await tx.projectRerunRequest.findFirst({
        where: {
          projectId,
          requesterId: user.id,
          status: { in: ['pending', 'approved', 'uploaded'] }
        }
      })
      if (activeRequest) throw new BadRequestException('该项目已有可用于二次抽取的项目验收材料')

      // Java 版现场规则：上传材料即进入 uploaded 状态，可直接用于二次抽取。
      const created = await tx.projectRerunRequest.create({
        data: {
          projectId,
          requesterId: user.id,
          status: 'uploaded',
          reason,
          attachments: {
            create: files.map((file) => ({
              originalName: file.originalname,
              storedName: file.filename,
              mimeType: file.mimetype,
              size: file.size,
              filePath: file.path
            }))
          }
        },
        include: this.rerunRequestInclude()
      })

      // 上传成功后通知本人，前端据此提示可发起二次抽取。
      await tx.notification.create({
        data: {
          userId: user.id,
          title: '项目验收材料已上传',
          content: `项目“${project.name}”已上传项目验收材料，可按规定发起二次抽取。`,
          projectId
        }
      })

      return created
    })

    return toRerunRequestRead(request)
  }

  async listRerunRequests() {
    // 保留超级管理员审核列表接口，兼容旧流程和后续可能恢复的审批要求。
    const requests = await this.prisma.projectRerunRequest.findMany({
      include: this.rerunRequestInclude(),
      orderBy: { createdAt: 'desc' }
    })
    return requests.map(toRerunRequestRead)
  }

  async reviewRerunRequest(user: any, id: number, dto: ReviewRerunRequestDto) {
    // 旧审批流只允许超级管理员处理，当前 uploaded 直通流程不会主动走这里。
    if (user.role !== 'super_admin') throw new ForbiddenException('仅超级管理员可审核')

    const request = await this.prisma.$transaction(async (tx) => {
      // 只有 pending 申请可审核，避免重复审批覆盖业务状态。
      const current = await tx.projectRerunRequest.findUnique({
        where: { id },
        include: { project: true, requester: true }
      })
      if (!current) throw new NotFoundException('二次抽取申请不存在')
      if (current.status !== 'pending') throw new BadRequestException('该申请已审核，不能重复处理')

      // 审核结果、审核人和审核时间一起落库，形成审批追溯。
      const updated = await tx.projectRerunRequest.update({
        where: { id },
        data: {
          status: dto.status,
          reviewComment: dto.comment,
          reviewerId: user.id,
          reviewedAt: new Date()
        },
        include: this.rerunRequestInclude()
      })

      // 审核完成后通知申请人，前端在我的项目中展示最新状态。
      await tx.notification.create({
        data: {
          userId: current.requesterId,
          title: dto.status === 'approved' ? '二次抽取申请已通过' : '二次抽取申请未通过',
          content:
            dto.status === 'approved'
              ? `项目“${current.project.name}”的二次抽取申请已通过审核，可在我的项目中发起二次抽取。`
              : `项目“${current.project.name}”的二次抽取申请未通过审核。${dto.comment ? `意见：${dto.comment}` : ''}`,
          projectId: current.projectId
        }
      })

      return updated
    })

    return toRerunRequestRead(request)
  }

  async rerun(user: any, projectId: number) {
    // 二次抽取只能由项目所属普通用户发起，管理员不能替用户重抽。
    if (user.role !== 'user') throw new ForbiddenException('仅课程责任单位可发起二次抽取')

    const project = await this.prisma.$transaction(async (tx) => {
      // 读取已有抽取记录，用于计算轮次并排除历史中选供应商。
      const current = await tx.project.findUnique({
        where: { id: projectId },
        include: {
          lotteryRecords: {
            orderBy: { roundNo: 'asc' }
          }
        }
      })
      if (!current) throw new NotFoundException('项目不存在')
      if (current.createdBy !== user.id) throw new ForbiddenException('无权操作该项目')
      if (!current.lotteryRecords.length) throw new BadRequestException('项目尚未完成首次抽取')

      // 当前规则允许 uploaded 或旧审批流 approved 的材料发起二次抽取。
      const request = await tx.projectRerunRequest.findFirst({
        where: { projectId, requesterId: user.id, status: { in: ['uploaded', 'approved'] }, usedAt: null },
        orderBy: { createdAt: 'desc' }
      })
      if (!request) throw new BadRequestException('请先上传 PDF 格式的项目验收材料')

      // 二次抽取不能再次抽中历史中选供应商。
      const excludedSupplierIds = current.lotteryRecords
        .map((record) => record.winnerSupplierId)
        .filter((id): id is number => Boolean(id))
      // 轮次从已有记录最大 roundNo 递增，通知书可区分首次/二次/多次抽取。
      const roundNo = Math.max(...current.lotteryRecords.map((record) => record.roundNo), 1) + 1
      const { record, winner } = await this.runLottery(tx, current, { roundNo, excludedSupplierIds })
      const resultNotice = this.buildResultNotice(current, winner, record)
      const emailStatus = this.sendResultEmails(current.contact, winner, resultNotice)

      // 材料使用后标记 used，防止同一份材料反复触发二次抽取。
      await tx.projectRerunRequest.update({
        where: { id: request.id },
        data: { status: 'used', usedAt: new Date() }
      })

      // 二次抽取结果同样通过站内通知反馈给项目提交人。
      await tx.notification.create({
        data: {
          userId: user.id,
          title: '二次抽取结果',
          content: winner
            ? `项目“${current.name}”已完成二次抽取，中选供应商为 ${winner.name}。`
            : `项目“${current.name}”已完成二次抽取，当前无符合条件的供应商。`,
          projectId
        }
      })

      return tx.project.update({
        where: { id: projectId },
        data: {
          status: winner ? 'completed' : 'no_supplier',
          resultNotice,
          emailStatus
        },
        include: this.projectInclude()
      })
    })

    return toProjectRead(project)
  }

  async getRerunAttachment(user: any, requestId: number, fileId: number) {
    // 材料下载允许管理员查看，也允许项目所属用户查看自己的材料。
    const request = await this.prisma.projectRerunRequest.findUnique({
      where: { id: requestId },
      include: { project: true, attachments: true }
    })
    if (!request) throw new NotFoundException('二次抽取申请不存在')
    if (!['admin', 'super_admin'].includes(user.role) && request.project.createdBy !== user.id) {
      throw new ForbiddenException('无权下载该材料')
    }
    const file = request.attachments.find((item) => item.id === fileId)
    if (!file) throw new NotFoundException('材料不存在')
    return file
  }

  async records() {
    // 抽取记录是全局追溯视图，保留每次抽取时的指针和中选排名快照。
    const records = await this.prisma.lotteryRecord.findMany({
      include: { project: true, winnerSupplier: true },
      orderBy: { lotteryTime: 'desc' }
    })
    return records.map(toLotteryRecordRead)
  }

  private async runLottery(
    tx: Prisma.TransactionClient,
    project: any,
    options: { roundNo?: number; excludedSupplierIds?: number[] } = {}
  ) {
    // 轮候抽取始终按供应商中标排名升序扫描候选池。
    const suppliers = await tx.supplier.findMany({
      where: { isDeleted: false },
      orderBy: { rank: 'asc' }
    })
    const today = new Date()
    const eligibleBeforeLoad = []
    for (const supplier of suppliers) {
      // 先排除处罚期供应商，再匹配涉密资质和二次抽取排除名单。
      const punished = await tx.punishment.findFirst({
        where: {
          supplierId: supplier.id,
          startDate: { lte: today },
          endDate: { gte: today }
        }
      })
      if (
        !options.excludedSupplierIds?.includes(supplier.id) &&
        !punished &&
        this.hasQualification(supplier, project.secretLevel)
      ) {
        eligibleBeforeLoad.push(supplier)
      }
    }
    // 负荷规则：只有候选池最大未结题在研数大于 5 时，才暂停最大负荷供应商。
    const maxActiveProjectCount = eligibleBeforeLoad.reduce(
      (max, supplier) => Math.max(max, supplier.activeProjectCount || 0),
      0
    )
    const eligible =
      maxActiveProjectCount > 5
        ? eligibleBeforeLoad.filter((supplier) => (supplier.activeProjectCount || 0) < maxActiveProjectCount)
        : eligibleBeforeLoad

    // 全局指针跨项目共用，记录上一次中选供应商排名。
    const pointer = await tx.systemConfig.upsert({
      where: { key: POINTER_KEY },
      update: {},
      create: { key: POINTER_KEY, value: '0' }
    })
    const pointerBefore = Number(pointer.value || '0')

    if (eligible.length === 0) {
      // 无符合条件供应商时指针归零，下一次从排名头部重新开始。
      await tx.systemConfig.update({ where: { key: POINTER_KEY }, data: { value: '0' } })
      const record = await tx.lotteryRecord.create({
        data: {
          projectId: project.id,
          winnerSupplierId: null,
          winnerRank: null,
          pointerBefore,
          pointerAfter: 0,
          roundNo: options.roundNo || 1
        }
      })
      return { record, winner: null }
    }

    // 从指针后找第一家候选供应商；没有则回到候选池第一家，形成循环轮候。
    const winner = eligible.find((supplier) => supplier.rank > pointerBefore) || eligible[0]
    await tx.systemConfig.update({ where: { key: POINTER_KEY }, data: { value: String(winner.rank) } })
    // 抽取记录保存指针前后状态，便于审计轮候过程。
    const record = await tx.lotteryRecord.create({
      data: {
        projectId: project.id,
        winnerSupplierId: winner.id,
        winnerRank: winner.rank,
        pointerBefore,
        pointerAfter: winner.rank,
        roundNo: options.roundNo || 1
      }
    })
    return { record, winner }
  }

  private hasQualification(supplier: any, level: string) {
    // 公开项目不要求资质；涉密项目按供应商维护的两类资质匹配。
    if (level === '公开') return true
    if (level === '装备类涉密') return supplier.qualEquipment
    if (level === '信息系统集成类涉密') return supplier.qualSystem
    return false
  }

  private buildResultNotice(project: any, winner: any, record: any) {
    // 通知书是给项目单位查看和留档的文本结果，直接根据抽取快照生成。
    const budget = Number(project.budgetWan).toFixed(2)
    const result = winner
      ? `推荐供应商：${winner.name}`
      : '推荐供应商：无符合条件的供应商'
    return [
      '供应商抽取结果通知书',
      `项目名称：${project.name}`,
      `项目概况：${project.overview || '无'}`,
      `预算金额：${budget} 万元`,
      `涉密要求：${project.secretLevel}`,
      `项目负责人：${project.managerName}`,
      `联系方式：${project.contact}`,
      result,
      `抽取时间：${this.formatDate(record.lotteryTime)}`
    ].join('\n')
  }

  private sendResultEmails(contact: string, winner: any, resultNotice: string) {
    // 邮件目前只做配置探测和状态标记，真实 SMTP 发送留给现场适配。
    if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) return 'smtp_not_configured'
    const recipients = []
    if (contact?.includes('@')) recipients.push(contact)
    if (winner?.email) recipients.push(winner.email)
    return recipients.length ? 'smtp_configured_pending_adapter' : 'no_email_recipient'
  }

  private formatDate(value: Date) {
    return value.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  private projectInclude() {
    return {
      creator: true,
      lotteryRecords: {
        include: { project: true, winnerSupplier: true }
      },
      rerunRequests: {
        include: this.rerunRequestInclude(),
        orderBy: { createdAt: 'desc' as const }
      }
    }
  }

  private rerunRequestInclude() {
    return {
      project: true,
      requester: true,
      reviewer: true,
      attachments: true
    }
  }

  private async validatePdfFiles(files: any[]) {
    try {
      await Promise.all(
        files.map(async (file) => {
          const handle = await open(file.path, 'r')
          try {
            const buffer = Buffer.alloc(4)
            await handle.read(buffer, 0, 4, 0)
            if (buffer.toString('utf8') !== PDF_HEADER) throw new BadRequestException('仅支持上传真实 PDF 文件')
          } finally {
            await handle.close()
          }
        })
      )
    } catch (error) {
      await Promise.all(files.map((file) => unlink(file.path).catch(() => undefined)))
      throw error
    }
  }
}
