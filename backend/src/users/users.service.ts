import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { toUserRead } from '../common/formatters'
import { PrismaService } from '../prisma/prisma.service'
import { CreateUserDto, UpdateActiveDto, UpdateRoleDto } from './users.dto'

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    // 用户管理页按创建时间倒序展示，便于管理员看到最近新增账号。
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } })
    return users.map(toUserRead)
  }

  async create(dto: CreateUserDto) {
    // 账号名是登录唯一标识，创建前先拦截重复账号。
    const exists = await this.prisma.user.findUnique({ where: { username: dto.username } })
    if (exists) throw new BadRequestException('账号已存在')
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash: await bcrypt.hash(dto.password, 10),
        role: dto.role,
        displayName: dto.display_name,
        email: dto.email,
        isActive: dto.is_active ?? true
      }
    })
    return toUserRead(user)
  }

  async updateRole(currentUser: any, id: number, dto: UpdateRoleDto) {
    // 超级管理员作为系统兜底账号，不允许在页面被降级或批量复制出来。
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('用户不存在')
    if (user.role === 'super_admin') {
      throw new BadRequestException('不可修改超级管理员角色')
    }
    if (dto.role === 'super_admin') {
      throw new BadRequestException('超级管理员系统唯一，不可通过页面新增或升级')
    }
    return toUserRead(await this.prisma.user.update({ where: { id }, data: { role: dto.role } }))
  }

  async updateActive(currentUser: any, id: number, dto: UpdateActiveDto) {
    // 防止管理员误停用自己或唯一超级管理员，避免现场失去管理入口。
    if (currentUser.id === id && !dto.is_active) throw new BadRequestException('不可停用当前登录账号')
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('用户不存在')
    if (user.role === 'super_admin') throw new BadRequestException('不可停用超级管理员账号')
    return toUserRead(await this.prisma.user.update({ where: { id }, data: { isActive: dto.is_active } }))
  }
}
