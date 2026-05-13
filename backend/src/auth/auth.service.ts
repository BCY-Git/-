import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'crypto'
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

  getSsoStatus() {
    return { enabled: process.env.SSO_ENABLED === 'true' }
  }

  async buildSsoAuthorizeUrl(returnUrl?: string) {
    const config = this.getSsoConfig()
    const state = await this.jwtService.signAsync(
      {
        type: 'sso_state',
        nonce: randomUUID(),
        returnUrl: this.safeReturnUrl(returnUrl)
      },
      { expiresIn: '10m' }
    )
    const url = new URL(config.authorizationUrl)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', config.clientId)
    url.searchParams.set('redirect_uri', config.redirectUri)
    url.searchParams.set('scope', config.scope)
    url.searchParams.set('state', state)
    return url.toString()
  }

  async handleSsoCallback(code?: string, state?: string) {
    if (!code || !state) throw new BadRequestException('统一认证回调参数缺失')
    const config = this.getSsoConfig()
    const statePayload = await this.verifySsoState(state)
    const token = await this.exchangeSsoCode(config, code)
    const profile = await this.fetchSsoUserInfo(config, token.access_token)
    const username = this.pickProfileField(profile, config.usernameField)
    if (!username) throw new UnauthorizedException('统一认证未返回用户账号')

    const user = await this.upsertSsoUser({
      username,
      displayName: this.pickProfileField(profile, config.displayNameField) || username,
      email: this.pickProfileField(profile, config.emailField),
      role: this.resolveSsoRole(username, config)
    })
    const appToken = await this.jwtService.signAsync({ sub: user.username })
    const callbackUrl = new URL(config.frontendCallbackUrl)
    callbackUrl.hash = new URLSearchParams({
      token: appToken,
      user: JSON.stringify(toUserRead(user)),
      return_url: statePayload.returnUrl
    }).toString()
    return callbackUrl.toString()
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

  private getSsoConfig() {
    const enabled = process.env.SSO_ENABLED === 'true'
    const config = {
      enabled,
      authorizationUrl: process.env.SSO_AUTHORIZATION_URL || '',
      tokenUrl: process.env.SSO_TOKEN_URL || '',
      userinfoUrl: process.env.SSO_USERINFO_URL || '',
      clientId: process.env.SSO_CLIENT_ID || '',
      clientSecret: process.env.SSO_CLIENT_SECRET || '',
      redirectUri: process.env.SSO_REDIRECT_URI || '',
      scope: process.env.SSO_SCOPE || 'openid profile email',
      frontendCallbackUrl: process.env.SSO_FRONTEND_CALLBACK_URL || 'http://127.0.0.1:5173/sso/callback',
      usernameField: process.env.SSO_USERNAME_FIELD || 'sub,username,account,user_name',
      displayNameField: process.env.SSO_DISPLAY_NAME_FIELD || 'name,display_name,realName,nickname',
      emailField: process.env.SSO_EMAIL_FIELD || 'email,mail',
      defaultRole: process.env.SSO_DEFAULT_ROLE || 'user',
      adminUsernames: this.parseList(process.env.SSO_ADMIN_USERNAMES),
      superAdminUsernames: this.parseList(process.env.SSO_SUPER_ADMIN_USERNAMES)
    }
    if (
      !config.enabled ||
      !config.authorizationUrl ||
      !config.tokenUrl ||
      !config.userinfoUrl ||
      !config.clientId ||
      !config.clientSecret ||
      !config.redirectUri
    ) {
      throw new BadRequestException('统一认证未配置或未启用')
    }
    return config
  }

  private async verifySsoState(state: string) {
    try {
      const payload = await this.jwtService.verifyAsync(state)
      if (payload.type !== 'sso_state') throw new Error('invalid state')
      return { returnUrl: this.safeReturnUrl(payload.returnUrl) }
    } catch {
      throw new BadRequestException('统一认证状态已失效')
    }
  }

  private async exchangeSsoCode(config: ReturnType<AuthService['getSsoConfig']>, code: string) {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret
    })
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.access_token) throw new UnauthorizedException('统一认证令牌换取失败')
    return data
  }

  private async fetchSsoUserInfo(config: ReturnType<AuthService['getSsoConfig']>, accessToken: string) {
    const response = await fetch(config.userinfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || !data) throw new UnauthorizedException('统一认证用户信息获取失败')
    return data
  }

  private async upsertSsoUser(input: { username: string; displayName?: string; email?: string; role: string }) {
    const existing = await this.prisma.user.findUnique({ where: { username: input.username } })
    if (existing) {
      if (!existing.isActive) throw new UnauthorizedException('账号已停用')
      return this.prisma.user.update({
        where: { username: input.username },
        data: {
          displayName: input.displayName || existing.displayName,
          email: input.email || existing.email,
          role: existing.role === 'super_admin' ? existing.role : input.role
        }
      })
    }
    return this.prisma.user.create({
      data: {
        username: input.username,
        passwordHash: await bcrypt.hash(randomUUID(), 10),
        role: input.role,
        displayName: input.displayName,
        email: input.email,
        isActive: true
      }
    })
  }

  private resolveSsoRole(username: string, config: ReturnType<AuthService['getSsoConfig']>) {
    if (config.superAdminUsernames.includes(username)) return 'super_admin'
    if (config.adminUsernames.includes(username)) return 'admin'
    return ['admin', 'user'].includes(config.defaultRole) ? config.defaultRole : 'user'
  }

  private pickProfileField(profile: Record<string, any>, fields: string) {
    for (const field of this.parseList(fields)) {
      const value = profile[field]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
    return undefined
  }

  private parseList(value?: string) {
    return (value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  private safeReturnUrl(value?: string) {
    if (!value || !value.startsWith('/')) return '/'
    if (value.startsWith('//')) return '/'
    return value
  }
}
