import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'
import { JwtPayload } from './current-user.type'

export const currentUserSelect = {
  id: true,
  username: true,
  role: true,
  displayName: true,
  email: true,
  ssoProvider: true,
  ssoUserUuid: true,
  ssoLoginName: true,
  ssoUnitUuid: true,
  ssoUnitName: true,
  ssoTelephone: true,
  isActive: true,
  createdAt: true,
  tokenVersion: true
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 所有受保护接口都从 Bearer Token 解析当前登录用户。
    const request = context.switchToHttp().getRequest()
    const authHeader = request.headers.authorization || ''
    const match = authHeader.match(/^Bearer\s+(.+)$/)
    const token = match?.[1]
    const type = match ? 'Bearer' : ''
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('登录已失效')
    }

    let payload: JwtPayload
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token)
    } catch {
      throw new UnauthorizedException('登录已失效')
    }

    const userId = Number(payload.sub)
    if (!Number.isInteger(userId) || typeof payload.tokenVersion !== 'number') {
      throw new UnauthorizedException('登录已失效')
    }

    // 只查询接口实际需要的用户字段，避免把 passwordHash 挂到 request.user。
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: currentUserSelect })
    if (!user || !user.isActive) throw new UnauthorizedException('账号不可用')
    if (user.tokenVersion !== payload.tokenVersion) throw new UnauthorizedException('登录已失效')
    request.user = user
    return true
  }
}
