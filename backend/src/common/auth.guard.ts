import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'

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
    const [type, token] = authHeader.split(' ')
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('登录已失效')
    }
    try {
      // JWT 只存 username，接口执行前再查数据库，确保停用账号立刻失效。
      const payload = await this.jwtService.verifyAsync(token)
      const user = await this.prisma.user.findUnique({ where: { username: payload.sub } })
      if (!user || !user.isActive) throw new UnauthorizedException('账号不可用')
      request.user = user
      return true
    } catch {
      throw new UnauthorizedException('登录已失效')
    }
  }
}
