import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { dateOnly, parseDateOnly, toPunishmentRead } from '../common/formatters'
import { PrismaService } from '../prisma/prisma.service'
import { PunishmentDto } from './punishments.dto'

@Injectable()
export class PunishmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    // 处罚状态由日期实时推导，列表返回时补上 active/ended 给前端展示。
    const punishments = await this.prisma.punishment.findMany({
      include: { supplier: true },
      orderBy: { createdAt: 'desc' }
    })
    return punishments.map((item) => toPunishmentRead(item, this.status(item)))
  }

  async create(user: any, dto: PunishmentDto) {
    // 处罚只能绑定当前有效供应商，已删除供应商不再参与业务操作。
    const supplier = await this.prisma.supplier.findFirst({ where: { id: dto.supplier_id, isDeleted: false } })
    if (!supplier) throw new NotFoundException('供应商不存在')
    const data = this.toData(dto)
    const punishment = await this.prisma.$transaction(async (tx) => {
      // 创建处罚和发送站内通知放在同一个事务里，避免只写一半业务结果。
      const created = await tx.punishment.create({
        data: { ...data, createdBy: user.id },
        include: { supplier: true }
      })

      const recipients = await tx.user.findMany({
        where: { isActive: true, role: { in: ['user', 'admin'] } },
        select: { id: true }
      })
      if (recipients.length) {
        // 普通用户和管理员都需要知道供应商被处罚，后续抽取会自动排除。
        await tx.notification.createMany({
          data: recipients.map((recipient) => ({
            userId: recipient.id,
            title: '供应商处罚通知',
            content: this.buildNotificationContent(created)
          }))
        })
      }

      return created
    })
    return toPunishmentRead(punishment, this.status(punishment))
  }

  async update(id: number, dto: PunishmentDto) {
    // 编辑处罚时重新校验供应商和日期，保证历史记录不会指向无效供应商。
    const current = await this.prisma.punishment.findUnique({ where: { id } })
    if (!current) throw new NotFoundException('处罚记录不存在')
    const supplier = await this.prisma.supplier.findFirst({ where: { id: dto.supplier_id, isDeleted: false } })
    if (!supplier) throw new NotFoundException('供应商不存在')
    const punishment = await this.prisma.punishment.update({
      where: { id },
      data: this.toData(dto),
      include: { supplier: true }
    })
    return toPunishmentRead(punishment, this.status(punishment))
  }

  async lift(user: any, id: number) {
    // 解除处罚只允许对进行中的处罚生效，已结束记录保持历史状态。
    const current = await this.prisma.punishment.findUnique({
      where: { id },
      include: { supplier: true }
    })
    if (!current) throw new NotFoundException('处罚记录不存在')
    if (this.status(current) !== 'active') throw new BadRequestException('只能解除进行中的处罚')

    const liftedAt = new Date()
    const endedAt = new Date(liftedAt)
    endedAt.setUTCDate(endedAt.getUTCDate() - 1)
    // 通过把结束日期改到昨天来解除处罚，保留原处罚记录和原因追溯。
    const endDate = parseDateOnly(dateOnly(endedAt))
    const punishment = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.punishment.update({
        where: { id },
        data: {
          endDate,
          reason: current.reason ? `${current.reason}\n解除说明：由${user.username || '超级管理员'}解除处罚` : `解除说明：由${user.username || '超级管理员'}解除处罚`
        },
        include: { supplier: true }
      })

      const recipients = await tx.user.findMany({
        where: { isActive: true, role: { in: ['user', 'admin'] } },
        select: { id: true }
      })
      if (recipients.length) {
        // 解除处罚会影响后续抽取候选池，需要同步通知相关角色。
        await tx.notification.createMany({
          data: recipients.map((recipient) => ({
            userId: recipient.id,
            title: '供应商解除处罚通知',
            content: this.buildLiftNotificationContent(updated, liftedAt)
          }))
        })
      }

      return updated
    })

    return toPunishmentRead(punishment, this.status(punishment))
  }

  async delete(id: number) {
    // 删除处罚是管理维护动作，会直接移除记录；解除处罚请走 lift 保留追溯。
    const current = await this.prisma.punishment.findUnique({ where: { id } })
    if (!current) throw new NotFoundException('处罚记录不存在')
    await this.prisma.punishment.delete({ where: { id } })
    return { message: '处罚记录已删除' }
  }

  private toData(dto: PunishmentDto) {
    // 前端只传日期字符串，后端统一转为当天零点并校验区间合法性。
    const startDate = parseDateOnly(dto.start_date)
    const endDate = parseDateOnly(dto.end_date)
    if (endDate < startDate) throw new BadRequestException('处罚结束日期不能早于开始日期')
    return { supplierId: dto.supplier_id, startDate, endDate, reason: dto.reason }
  }

  private status(item: { startDate: Date; endDate: Date }) {
    // 处罚是否生效不落库，避免定时任务维护状态。
    const today = new Date()
    return item.startDate <= today && item.endDate >= today ? 'active' : 'ended'
  }

  private buildNotificationContent(punishment: any) {
    const reason = punishment.reason ? `处罚原因：${punishment.reason}` : '处罚原因：未填写'
    return [
      `供应商“${punishment.supplier.name}”已被管理员记录处罚。`,
      `处罚期：${dateOnly(punishment.startDate)} 至 ${dateOnly(punishment.endDate)}。`,
      '处罚期内该供应商将自动排除出项目抽取范围。',
      reason
    ].join('\n')
  }

  private buildLiftNotificationContent(punishment: any, liftedAt: Date) {
    return [
      `供应商“${punishment.supplier.name}”已由超级管理员解除处罚。`,
      `解除日期：${dateOnly(liftedAt)}。`,
      '解除后该供应商可按资质条件参与后续项目抽取。'
    ].join('\n')
  }
}
