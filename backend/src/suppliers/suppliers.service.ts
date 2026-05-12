import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { toSupplierRead } from '../common/formatters'
import { PrismaService } from '../prisma/prisma.service'
import { SupplierDto } from './suppliers.dto'

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async isPunished(supplierId: number, today = new Date()) {
    // 处罚状态按当前日期实时计算，不单独落状态字段，避免日期跨天后状态失真。
    const active = await this.prisma.punishment.findFirst({
      where: {
        supplierId,
        startDate: { lte: today },
        endDate: { gte: today }
      }
    })
    return Boolean(active)
  }

  async list() {
    // 供应商列表只展示未删除供应商，并补充处罚状态给前端显示。
    const suppliers = await this.prisma.supplier.findMany({
      where: { isDeleted: false },
      orderBy: { rank: 'asc' }
    })
    return Promise.all(suppliers.map(async (item) => toSupplierRead(item, await this.isPunished(item.id))))
  }

  async create(dto: SupplierDto) {
    // 新增时先检查未删除供应商，保证名称和中标排名在有效供应商中唯一。
    await this.assertUnique(dto.name, dto.rank)
    // 如果同名或同排名供应商只是被软删除，则复用原记录，避免唯一索引挡住重新新增。
    const deleted = await this.prisma.supplier.findFirst({
      where: {
        isDeleted: true,
        OR: [{ name: dto.name }, { rank: dto.rank }]
      },
      orderBy: [{ name: 'asc' }, { rank: 'asc' }]
    })
    if (deleted) {
      // 清掉其它软删除冲突记录，只保留本次要恢复的供应商。
      await this.cleanupDeletedConflicts(deleted.id, dto.name, dto.rank)
      const restored = await this.prisma.supplier.update({
        where: { id: deleted.id },
        data: this.toData(dto, { isDeleted: false })
      })
      return toSupplierRead(restored, await this.isPunished(restored.id))
    }
    // 没有可恢复记录时才创建新供应商。
    const supplier = await this.prisma.supplier.create({
      data: this.toData(dto)
    })
    return toSupplierRead(supplier)
  }

  async update(id: number, dto: SupplierDto) {
    // 编辑只允许作用在有效供应商上，软删除记录不能被普通编辑入口恢复。
    const supplier = await this.prisma.supplier.findFirst({ where: { id, isDeleted: false } })
    if (!supplier) throw new NotFoundException('供应商不存在')
    await this.assertUnique(dto.name, dto.rank, id)
    // 供应商改名或改排名时，同步清理软删除冲突，防止后续新增再撞唯一索引。
    await this.cleanupDeletedConflicts(id, dto.name, dto.rank)
    const updated = await this.prisma.supplier.update({
      where: { id },
      data: this.toData(dto)
    })
    return toSupplierRead(updated, await this.isPunished(updated.id))
  }

  async delete(id: number) {
    // 删除采用软删除，保留历史项目和抽取记录中的供应商引用。
    const supplier = await this.prisma.supplier.findFirst({ where: { id, isDeleted: false } })
    if (!supplier) throw new NotFoundException('供应商不存在')
    await this.prisma.supplier.update({ where: { id }, data: { isDeleted: true } })
    return { message: '供应商已删除' }
  }

  private async assertUnique(name: string, rank: number, excludeId?: number) {
    // 只对未删除供应商做业务唯一校验，软删除冲突由恢复/清理逻辑处理。
    const nameConflict = await this.prisma.supplier.findFirst({
      where: { name, isDeleted: false, ...(excludeId ? { id: { not: excludeId } } : {}) }
    })
    if (nameConflict) throw new BadRequestException('供应商名称已存在')
    const rankConflict = await this.prisma.supplier.findFirst({
      where: { rank, isDeleted: false, ...(excludeId ? { id: { not: excludeId } } : {}) }
    })
    if (rankConflict) throw new BadRequestException('中标排名已存在')
  }

  private async cleanupDeletedConflicts(keepId: number, name: string, rank: number) {
    // SQLite 唯一索引仍会约束软删除行，因此需要物理删除多余的软删除冲突数据。
    await this.prisma.supplier.deleteMany({
      where: {
        isDeleted: true,
        id: { not: keepId },
        OR: [{ name }, { rank }]
      }
    })
  }

  private toData(dto: SupplierDto, extra: Record<string, any> = {}) {
    // 前端使用下划线字段，数据库使用驼峰字段，这里集中做字段映射。
    return {
      name: dto.name,
      rank: dto.rank,
      qualEquipment: dto.qual_equipment,
      qualSystem: dto.qual_system,
      activeProjectCount: dto.active_project_count,
      contactName: dto.contact_name,
      contactPhone: dto.contact_phone,
      email: dto.email,
      ...extra
    }
  }
}
