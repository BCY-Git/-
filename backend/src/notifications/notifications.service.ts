import { NotFoundException } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { toNotificationRead } from '../common/formatters'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: any) {
    // 通知只返回当前用户自己的消息，同时计算未读数量供顶部徽标展示。
    const items = await this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    })
    return {
      unread_count: items.filter((item) => !item.isRead).length,
      items: items.map(toNotificationRead)
    }
  }

  async read(user: any, id: number) {
    // 单条已读必须限定 userId，避免用户标记他人的通知。
    const item = await this.prisma.notification.findFirst({ where: { id, userId: user.id } })
    if (!item) throw new NotFoundException('通知不存在')
    await this.prisma.notification.update({ where: { id }, data: { isRead: true } })
    return { message: '已读' }
  }

  async readAll(user: any) {
    // 全部已读只作用于当前用户的通知。
    await this.prisma.notification.updateMany({ where: { userId: user.id }, data: { isRead: true } })
    return { message: '全部已读' }
  }
}
