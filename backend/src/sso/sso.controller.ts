import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common'
import { Response } from 'express'
import { SsoService } from './sso.service'

@Controller('sso')
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}
// 统一认证登录入口
  @Get('login')
  async login(@Res() response: Response) {
    // 入口只负责跳转学校统一认证，client_secret 永远留在后端。
    response.redirect(await this.ssoService.buildAuthorizeUrl())
  }

  @Get('config-check')
  configCheck() {
    // 现场联调前用于检查 SSO 环境变量是否齐全；不会返回 client_secret。
    return this.ssoService.checkConfig()
  }

  // 统一认证回调
  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() response: Response) {
    // 回调收到 code 后由后端换 token、拉用户信息、同步本地账号，再回到前端。
    const result = await this.ssoService.completeLogin(code, state)
    response.redirect(result.redirect_url)
  }
  
  @Post('ticket')
  consumeTicket(@Body('ticket') ticket: string) {
    // 前端用一次性 ticket 换取本系统 JWT，避免 JWT 直接暴露在浏览器地址栏。
    return this.ssoService.consumeTicket(ticket)
  }
}
