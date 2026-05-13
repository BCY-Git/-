import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { toUserRead } from '../common/formatters'
import { PrismaService } from '../prisma/prisma.service'
import { LoginDto, PasswordChangeDto } from './auth.dto'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async login(dto: LoginDto) {
    // 登录只校验本地账号密码；后续接单点登录时仍由这里统一签发系统 JWT。
    const user = await this.prisma.user.findUnique({ where: { username: dto.username } })
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('账号或密码错误')
    }
    // 停用账号即使密码正确也不能进入系统，避免绕过后台账号管理。
    if (!user.isActive) throw new UnauthorizedException('账号已停用')
    return {
      access_token: await this.jwtService.signAsync({ sub: user.username }),
      token_type: 'bearer',
      user: toUserRead(user)
    }
  }

  async changePassword(user: any, dto: PasswordChangeDto) {
    // 改密必须先校验旧密码，防止登录态泄露后被直接接管账号。
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } })
    if (!dbUser || !(await bcrypt.compare(dto.old_password, dbUser.passwordHash))) {
      throw new BadRequestException('原密码错误')
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(dto.new_password, 10) }
    })
    return { message: '密码已更新' }
  }
}
