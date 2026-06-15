import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/current-user.decorator'
import type { CurrentUserEntity } from '../common/current-user.type'
import { toUserRead } from '../common/formatters'
import { AuthGuard } from '../common/auth.guard'
import { AuthService } from './auth.service'
import { LoginDto, PasswordChangeDto } from './auth.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {//这里的@body是nestjs的装饰器，用于从请求体中获取数据
    return this.authService.login(dto)
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: CurrentUserEntity) {
    return toUserRead(user)
  }

  @Put('password')
  @UseGuards(AuthGuard)
  changePassword(@CurrentUser() user: CurrentUserEntity, @Body() dto: PasswordChangeDto) {
    return this.authService.changePassword(user, dto)
  }
}
