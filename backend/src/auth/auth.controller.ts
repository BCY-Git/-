import { Body, Controller, Get, Post, Put, Query, Res, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/current-user.decorator'
import { toUserRead } from '../common/formatters'
import { AuthGuard } from '../common/auth.guard'
import { AuthService } from './auth.service'
import { LoginDto, PasswordChangeDto } from './auth.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  @Get('sso/status')
  ssoStatus() {
    return this.authService.getSsoStatus()
  }

  @Get('sso/start')
  async ssoStart(@Query('return_url') returnUrl: string | undefined, @Res() res: any) {
    const redirectUrl = await this.authService.buildSsoAuthorizeUrl(returnUrl)
    return res.redirect(redirectUrl)
  }

  @Get('sso/callback')
  async ssoCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: any
  ) {
    const callbackUrl = await this.authService.handleSsoCallback(code, state)
    return res.redirect(callbackUrl)
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: any) {
    return toUserRead(user)
  }

  @Put('password')
  @UseGuards(AuthGuard)
  changePassword(@CurrentUser() user: any, @Body() dto: PasswordChangeDto) {
    return this.authService.changePassword(user, dto)
  }
}
