import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import type { CurrentUserEntity } from '../common/current-user.type'
import { toUserRead } from '../common/formatters'
import { PrismaService } from '../prisma/prisma.service'
import { LoginDto, PasswordChangeDto } from './auth.dto'

const LOGIN_WINDOW_MS = 60_000
const LOGIN_MAX_ATTEMPTS = 10
const loginAttempts = new Map<string, { count: number; resetAt: number }>()

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async login(dto: LoginDto) {
    this.assertLoginAllowed(dto.username)
    // 登录只校验本地账号密码；后续接单点登录时仍由这里统一签发系统 JWT。
    const user = await this.prisma.user.findUnique({ where: { username: dto.username } })
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('账号或密码错误')
    }
    // 停用账号即使密码正确也不能进入系统，避免绕过后台账号管理。
    if (!user.isActive) throw new UnauthorizedException('账号已停用')
    this.clearLoginAttempts(dto.username)
    return {
      access_token: await this.signUserToken(user),
      token_type: 'bearer',
      user: toUserRead(user)
    }
  }

  async changePassword(user: CurrentUserEntity, dto: PasswordChangeDto) {
    // 改密必须先校验旧密码，防止登录态泄露后被直接接管账号。
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } })
    if (!dbUser || !(await bcrypt.compare(dto.old_password, dbUser.passwordHash))) {
      throw new BadRequestException('原密码错误')
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(dto.new_password, 10),
        tokenVersion: { increment: 1 }
      }
    })
    return { message: '密码已更新' }
  }

  signUserToken(user: { id: number; username: string; tokenVersion: number }) {
    return this.jwtService.signAsync({
      sub: user.id,
      username: user.username,
      tokenVersion: user.tokenVersion
    })
  }

  private assertLoginAllowed(username: string) {
    const key = username.trim().toLowerCase()
    const now = Date.now()
    const current = loginAttempts.get(key)
    if (!current || current.resetAt <= now) {
      loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
      return
    }
    if (current.count >= LOGIN_MAX_ATTEMPTS) {
      throw new HttpException('登录尝试过于频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS)
    }
    current.count += 1
  }

  private clearLoginAttempts(username: string) {
    loginAttempts.delete(username.trim().toLowerCase())
  }
}
