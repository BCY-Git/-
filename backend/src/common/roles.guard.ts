import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from './roles.decorator'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 读取接口上的 @Roles 元数据；没声明角色的接口只要求登录。
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ])
    if (!roles?.length) return true
    const user = context.switchToHttp().getRequest().user
    if (!user?.role) throw new UnauthorizedException('登录已失效')
    // 当前用户角色必须命中接口允许角色，否则返回权限不足。
    if (roles.includes(user.role)) return true
    throw new ForbiddenException('权限不足')
  }
}
