import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import * as bcrypt from 'bcryptjs'
import type { CurrentUserEntity } from '../common/current-user.type'
import { toUserRead } from '../common/formatters'
import { PrismaService } from '../prisma/prisma.service'
import type { SsoUserSyncInput } from '../sso/sso.types'
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
        role: 'user',
        displayName: dto.display_name,
        email: dto.email,
        isActive: dto.is_active ?? true
      }
    })
    return toUserRead(user)
  }

  async syncFromSso(input: SsoUserSyncInput) {
    // SSO 用户优先按统一认证 userUuid 绑定；首次接入时可用 loginName 绑定同名本地账号。
    const loginName = input.loginName.trim()
    const userUuid = input.userUuid.trim()
    if (!loginName || !userUuid) throw new BadRequestException('统一认证返回的用户标识不完整')

    const byUuid = await this.prisma.user.findUnique({ where: { ssoUserUuid: userUuid } })
    const byUsername = byUuid ? null : await this.prisma.user.findUnique({ where: { username: loginName } })
    if (byUsername && !byUsername.ssoUserUuid && ['admin', 'super_admin'].includes(byUsername.role)) {
      throw new BadRequestException('统一认证账号不可自动绑定本地管理员账号，请由超级管理员先完成账号绑定')
    }
    const user = byUuid || byUsername
    const mappedRole = input.role === 'admin' ? 'admin' : 'user'
    const data = {
      displayName: input.userName?.trim() || loginName,
      email: input.email?.trim() || null,
      ssoProvider: input.provider,
      ssoUserUuid: userUuid,
      ssoLoginName: loginName,
      ssoUnitUuid: input.unitUuid?.trim() || null,
      ssoUnitName: input.unitName?.trim() || null,
      ssoTelephone: input.telephone?.trim() || null
    }

    if (user) {
      const nextRole = user.role === 'super_admin' || user.role === 'admin' ? user.role : mappedRole
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { ...data, role: nextRole }
      })
      if (!updated.isActive) throw new BadRequestException('账号已停用')
      return updated
    }

    return this.prisma.user.create({
      data: {
        username: loginName,
        passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
        role: mappedRole,
        isActive: true,
        ...data
      }
    })
  }

  async updateRole(currentUser: CurrentUserEntity, id: number, dto: UpdateRoleDto) {
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

  async updateActive(currentUser: CurrentUserEntity, id: number, dto: UpdateActiveDto) {
    // 防止管理员误停用自己或唯一超级管理员，避免现场失去管理入口。
    if (currentUser.id === id && !dto.is_active) throw new BadRequestException('不可停用当前登录账号')
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('用户不存在')
    if (user.role === 'super_admin') throw new BadRequestException('不可停用超级管理员账号')
    return toUserRead(await this.prisma.user.update({ where: { id }, data: { isActive: dto.is_active } }))
  }
}
