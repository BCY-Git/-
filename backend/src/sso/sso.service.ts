import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'node:crypto'
import { AuthService } from '../auth/auth.service'
import { toUserRead } from '../common/formatters'
import { UsersService } from '../users/users.service'
import type { LocalSsoRole, SsoProfileResponse, SsoUserSyncInput } from './sso.types'

const SSO_REQUEST_TIMEOUT_MS = 10_000
const SSO_TICKET_TTL_MS = 60_000

interface SsoConfig {
  baseUrl: string
  clientId: string
  clientSecret: string
  redirectUri: string
  frontendCallbackUrl: string
  adminRoleUuids: Set<string>// 管理员角色UUID集合
}

interface SsoTicketSession {
  token: string
  user: any
  expiresAt: number
}

@Injectable()
export class SsoService {
  private readonly ticketSessions = new Map<string, SsoTicketSession>()// 一次性 ticket 会话集合
  private cleanupTimer: NodeJS.Timeout

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService
  ) {
    this.cleanupTimer = setInterval(() => this.cleanupExpiredTickets(), SSO_TICKET_TTL_MS)
    this.cleanupTimer.unref?.()
  }
// 构建统一认证授权链接
  async buildAuthorizeUrl() {
    const config = this.getConfig()
    const url = new URL('/oauth2.0/authorize', config.baseUrl)
    url.searchParams.set('response_type', 'code')// 授权码模式
    url.searchParams.set('client_id', config.clientId)// 客户端ID
    url.searchParams.set('redirect_uri', config.redirectUri)// 重定向URI
    url.searchParams.set(
      'state',
      await this.jwtService.signAsync({ purpose: 'sso_state', nonce: randomUUID() }, { expiresIn: '10m' })
    )// 状态参数，用于防止CSRF攻击
    return url.toString()
  }
// 完成统一认证登录
  async completeLogin(code: string, state?: string) {
    if (!code?.trim()) throw new BadRequestException('缺少统一认证授权码')
    if (!state?.trim()) throw new UnauthorizedException('缺少统一认证 state')
    await this.verifyState(state)

    const config = this.getConfig()
    const accessToken = await this.exchangeCode(config, code.trim())
    const profile = await this.fetchProfile(config, accessToken)
    const user = await this.usersService.syncFromSso(this.toSyncInput(profile, config))
    const token = await this.authService.signUserToken(user)
    const ticket = this.createTicketSession(token, toUserRead(user))

    return {
      redirect_url: this.buildFrontendCallbackUrl(config.frontendCallbackUrl, ticket)
    }
  }

  consumeTicket(ticket: string) {
    if (!ticket?.trim()) throw new BadRequestException('缺少统一认证 ticket')
    const session = this.ticketSessions.get(ticket)
    this.ticketSessions.delete(ticket)
    if (!session || session.expiresAt < Date.now()) {
      throw new UnauthorizedException('统一认证 ticket 已失效')
    }
    return {
      access_token: session.token,
      token_type: 'bearer',
      user: session.user
    }
  }

  checkConfig() {
    const baseUrl = process.env.SSO_BASE_URL?.trim()
    const clientId = process.env.SSO_CLIENT_ID?.trim()
    const clientSecret = process.env.SSO_CLIENT_SECRET?.trim()
    const redirectUri = process.env.SSO_REDIRECT_URI?.trim()
    const frontendCallbackUrl = process.env.SSO_FRONTEND_CALLBACK_URL?.trim() || 'http://localhost:8100/sso/callback'
    const adminRoleUuids = this.toSet(process.env.SSO_ADMIN_ROLE_UUIDS)
    const missing = [
      ['SSO_BASE_URL', baseUrl],
      ['SSO_CLIENT_ID', clientId],
      ['SSO_CLIENT_SECRET', clientSecret],
      ['SSO_REDIRECT_URI', redirectUri]
    ].filter(([, value]) => !value).map(([name]) => name)
    const warnings: string[] = []

    const baseUrlCheck = this.checkHttpUrl(baseUrl)
    const redirectUriCheck = this.checkHttpUrl(redirectUri)
    const frontendCallbackUrlCheck = this.checkHttpUrl(frontendCallbackUrl)
    if (frontendCallbackUrlCheck.ok && new URL(frontendCallbackUrl).pathname !== '/sso/callback') {
      frontendCallbackUrlCheck.ok = false
      frontendCallbackUrlCheck.message = '必须指向前端 /sso/callback 页面'
    }
    if (redirectUriCheck.ok && !new URL(redirectUri!).pathname.endsWith('/api/v1/sso/callback')) {
      warnings.push('SSO_REDIRECT_URI 通常应以 /api/v1/sso/callback 结尾，请确认和学校登记地址完全一致')
    }
    if (redirectUriCheck.ok && new URL(redirectUri!).hostname === 'localhost') {
      warnings.push('正式环境不能使用 localhost 作为 SSO_REDIRECT_URI')
    }
    if (frontendCallbackUrlCheck.ok && new URL(frontendCallbackUrl).hostname === 'localhost') {
      warnings.push('正式环境不能使用 localhost 作为 SSO_FRONTEND_CALLBACK_URL')
    }
    if (!adminRoleUuids.size) {
      warnings.push('未配置 SSO_ADMIN_ROLE_UUIDS，统一认证登录用户默认均为普通用户')
    }

    return {
      ok: missing.length === 0 && baseUrlCheck.ok && redirectUriCheck.ok && frontendCallbackUrlCheck.ok,
      missing,
      endpoints: {
        login_url: '/api/v1/sso/login',
        callback_url: redirectUri || null,
        frontend_callback_url: frontendCallbackUrl
      },
      checks: {
        sso_base_url: baseUrlCheck,
        sso_redirect_uri: redirectUriCheck,
        sso_frontend_callback_url: frontendCallbackUrlCheck,
        client_id_configured: Boolean(clientId),
        client_secret_configured: Boolean(clientSecret),
        admin_role_uuid_count: adminRoleUuids.size
      },
      warnings
    }
  }
// 获取统一认证配置
  private getConfig(): SsoConfig {
    const baseUrl = process.env.SSO_BASE_URL?.trim()
    const clientId = process.env.SSO_CLIENT_ID?.trim()
    const clientSecret = process.env.SSO_CLIENT_SECRET?.trim()
    const redirectUri = process.env.SSO_REDIRECT_URI?.trim()
    const frontendCallbackUrl = process.env.SSO_FRONTEND_CALLBACK_URL?.trim() || 'http://localhost:8100/sso/callback'
    if (!baseUrl || !clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException('统一认证未配置完整，请检查 SSO_BASE_URL、SSO_CLIENT_ID、SSO_CLIENT_SECRET、SSO_REDIRECT_URI')
    }
    this.assertHttpUrl(baseUrl, 'SSO_BASE_URL')
    this.assertHttpUrl(redirectUri, 'SSO_REDIRECT_URI')
    this.assertHttpUrl(frontendCallbackUrl, 'SSO_FRONTEND_CALLBACK_URL')
    return {
      baseUrl,
      clientId,
      clientSecret,
      redirectUri,
      frontendCallbackUrl,
      adminRoleUuids: this.toSet(process.env.SSO_ADMIN_ROLE_UUIDS)
    }
  }

// 通过授权码换取访问令牌
  private async exchangeCode(config: SsoConfig, code: string) {
    const url = new URL('/oauth2.0/accessToken', config.baseUrl)
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri
    })
    // client_secret 放在 POST 表单体，避免出现在 URL、代理日志和浏览器历史中。
    const data = await this.fetchJson<{ access_token?: string }>(
      url.toString(),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      },
      '统一认证换取 token 失败'
    )
    if (!data.access_token) throw new UnauthorizedException('统一认证未返回 access_token')
    return data.access_token
  }

// 获取用户信息
  private async fetchProfile(config: SsoConfig, accessToken: string) {
    const url = new URL('/oauth2.0/profile', config.baseUrl)
    url.searchParams.set('access_token', accessToken)// 访问令牌
    return this.fetchJson<SsoProfileResponse>(url.toString(), undefined, '统一认证获取用户信息失败')
  }

// 发送请求并解析 JSON 响应
  private async fetchJson<T>(url: string, init: RequestInit | undefined, fallbackMessage: string): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), SSO_REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(url, { ...(init || {}), signal: controller.signal })
      const text = await response.text()
      let data: any = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = null
      }
      if (!response.ok) {
        throw new UnauthorizedException(data?.message || data?.detail || fallbackMessage)
      }
      return data as T
    } catch (error: any) {
      if (error?.name === 'AbortError') throw new UnauthorizedException(`${fallbackMessage}：请求超时`)
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

// 将 SSO 用户信息转换为同步输入
  private toSyncInput(profile: SsoProfileResponse, config: SsoConfig): SsoUserSyncInput {
    const attributes = profile.attributes || {}
    const loginName = attributes.loginName || profile.id || ''
    const userUuid = attributes.userUuid || profile.id || ''
    if (!loginName || !userUuid) throw new UnauthorizedException('统一认证用户信息缺少 loginName 或 userUuid')

    return {
      provider: 'cas-oauth2',
      loginName,
      userUuid,
      userName: attributes.userName,
      email: attributes.email,
      telephone: attributes.telephone,
      unitUuid: attributes.unitUuid,
      unitName: attributes.unitName,
      roleUuid: attributes.roleUuid,
      role: this.mapRole(attributes.roleUuid, config.adminRoleUuids)
    }
  }

// 映射角色
  private mapRole(roleUuid: string | undefined, adminRoleUuids: Set<string>): LocalSsoRole {
    return roleUuid && adminRoleUuids.has(roleUuid) ? 'admin' : 'user'
  }

// 验证 state
  private async verifyState(state: string) {
    const payload = await this.jwtService.verifyAsync(state).catch(() => null)
    if (!payload || payload.purpose !== 'sso_state') throw new UnauthorizedException('统一认证 state 校验失败')
  }

// 构建前端回调 URL
  private buildFrontendCallbackUrl(frontendCallbackUrl: string, ticket: string) {
    const url = new URL(frontendCallbackUrl)
    if (url.pathname !== '/sso/callback') {
      throw new ServiceUnavailableException('SSO_FRONTEND_CALLBACK_URL 必须指向前端 /sso/callback 页面')
    }
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
    hashParams.set('ticket', ticket)
    url.hash = hashParams.toString()
    return url.toString()
  }

// 将逗号分隔的字符串转换为 Set
  private toSet(value?: string) {
    return new Set((value || '').split(',').map((item) => item.trim()).filter(Boolean))
  }

  private createTicketSession(token: string, user: any) {
    this.cleanupExpiredTickets()
    const ticket = randomUUID()
    this.ticketSessions.set(ticket, {
      token,
      user,
      expiresAt: Date.now() + SSO_TICKET_TTL_MS
    })
    return ticket
  }

  private cleanupExpiredTickets() {
    const now = Date.now()
    for (const [ticket, session] of this.ticketSessions.entries()) {
      if (session.expiresAt < now) this.ticketSessions.delete(ticket)
    }
  }

  private assertHttpUrl(value: string, name: string) {
    let url: URL
    try {
      url = new URL(value)
    } catch {
      throw new ServiceUnavailableException(`${name} 必须是合法 URL`)
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new ServiceUnavailableException(`${name} 只允许 http 或 https`)
    }
  }

  private checkHttpUrl(value?: string) {
    if (!value) return { ok: false, message: '未配置' }
    try {
      const url = new URL(value)
      if (!['http:', 'https:'].includes(url.protocol)) return { ok: false, message: '只允许 http 或 https' }
      return { ok: true, protocol: url.protocol.replace(':', ''), host: url.host, pathname: url.pathname }
    } catch {
      return { ok: false, message: '不是合法 URL' }
    }
  }
}
